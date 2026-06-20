import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  provisionTenant,
  createTenantUser,
} from "@/lib/provisioning/provision-tenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ingestArticle } from "@/lib/kb/ingest";
import { getEmbeddingsProvider } from "@/lib/ai/embeddings";
import { getLlmProvider } from "@/lib/ai/llm";
import { answerQuestionWith } from "@/lib/ai/answer";

/**
 * Phase 4 AI pipeline: RAG answer, escalation paths, cross-tenant retrieval
 * isolation, and the agents-only read RLS on the new tables. Uses the stub
 * embeddings + LLM providers (no keys). Requires SUPABASE_SERVICE_ROLE_KEY.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!hasServiceKey) {
  console.warn("[ai-isolation] SUPABASE_SERVICE_ROLE_KEY not set — skipping.");
}

function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(email: string, password: string) {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return client;
}

describe.runIf(hasServiceKey)("ai support pipeline", () => {
  const s = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const pw = "Ai!12345678";
  const ownerA = { email: `ai-ownerA-${s}@example.test`, password: pw };
  const agentA = { email: `ai-agentA-${s}@example.test`, password: pw };
  const userA = { email: `ai-userA-${s}@example.test`, password: pw };
  const ownerB = { email: `ai-ownerB-${s}@example.test`, password: pw };
  const userB = { email: `ai-userB-${s}@example.test`, password: pw };

  let tenantA = "";
  let tenantB = "";
  const ids: string[] = [];
  let userAId = "";
  let userBId = "";

  const embeddings = getEmbeddingsProvider();
  const llm = getLlmProvider();

  beforeAll(async () => {
    const a = await provisionTenant({
      tenantName: "AI A",
      tenantSlug: `ai-a-${s}`,
      ownerEmail: ownerA.email,
      ownerPassword: ownerA.password,
    });
    tenantA = a.tenantId;
    ids.push(a.ownerUserId);

    const b = await provisionTenant({
      tenantName: "AI B",
      tenantSlug: `ai-b-${s}`,
      ownerEmail: ownerB.email,
      ownerPassword: ownerB.password,
    });
    tenantB = b.tenantId;
    ids.push(b.ownerUserId);

    const ag = await createTenantUser({
      tenantId: tenantA,
      email: agentA.email,
      password: agentA.password,
      role: "agent",
    });
    ids.push(ag.userId);

    const ua = await createTenantUser({
      tenantId: tenantA,
      email: userA.email,
      password: userA.password,
      role: "end_user",
    });
    userAId = ua.userId;
    ids.push(ua.userId);

    const ub = await createTenantUser({
      tenantId: tenantB,
      email: userB.email,
      password: userB.password,
      role: "end_user",
    });
    userBId = ub.userId;
    ids.push(ub.userId);

    // Tenant A gets a published, embedded KB article. Tenant B has none.
    const admin = createSupabaseAdminClient();
    const { data: article, error } = await admin
      .from("kb_articles")
      .insert({
        tenant_id: tenantA,
        title: "Connecting to the VPN",
        body: "To connect to the VPN, install GlobalProtect and sign in with your company email.",
        status: "published",
      })
      .select("id")
      .single();
    if (error || !article) throw new Error(`seed article: ${error?.message}`);
    await ingestArticle(article.id);
  });

  afterAll(async () => {
    if (!hasServiceKey) return;
    const admin = createSupabaseAdminClient();
    for (const id of ids) await admin.auth.admin.deleteUser(id).catch(() => {});
    for (const t of [tenantA, tenantB]) {
      if (t) await admin.from("tenants").delete().eq("id", t);
    }
  });

  it("answers a KB-answerable question with citations and logs it", async () => {
    const rls = await signIn(userA.email, userA.password);
    const admin = createSupabaseAdminClient();
    const outcome = await answerQuestionWith("How do I connect to the VPN?", {
      ctx: { tenantId: tenantA, userId: userAId, role: "end_user", email: userA.email },
      rls,
      admin,
      embeddings,
      llm,
    });

    expect(outcome.escalated).toBe(false);
    expect(outcome.answer).toBeTruthy();
    expect(outcome.citations.length).toBeGreaterThan(0);

    const { data } = await admin
      .from("ai_interactions")
      .select("escalated, tenant_id")
      .eq("id", outcome.interactionId)
      .single();
    expect(data?.escalated).toBe(false);
    expect(data?.tenant_id).toBe(tenantA);
  });

  it("escalates to a human ticket when the user asks for one", async () => {
    const rls = await signIn(userA.email, userA.password);
    const admin = createSupabaseAdminClient();
    const outcome = await answerQuestionWith(
      "This is urgent, I want to talk to a human.",
      {
        ctx: { tenantId: tenantA, userId: userAId, role: "end_user", email: userA.email },
        rls,
        admin,
        embeddings,
        llm,
      },
    );

    expect(outcome.escalated).toBe(true);
    expect(outcome.reason).toBe("user_request");
    expect(outcome.ticketId).toBeTruthy();

    const { data: esc } = await admin
      .from("escalations")
      .select("reason, tenant_id")
      .eq("ticket_id", outcome.ticketId!)
      .single();
    expect(esc?.reason).toBe("user_request");
    expect(esc?.tenant_id).toBe(tenantA);
  });

  it("escalates (no_context) and cannot retrieve another tenant's KB", async () => {
    // Tenant B has no KB, so the same VPN question finds nothing — proving B
    // cannot retrieve tenant A's published chunk.
    const rls = await signIn(userB.email, userB.password);
    const admin = createSupabaseAdminClient();
    const outcome = await answerQuestionWith("How do I connect to the VPN?", {
      ctx: { tenantId: tenantB, userId: userBId, role: "end_user", email: userB.email },
      rls,
      admin,
      embeddings,
      llm,
    });

    expect(outcome.escalated).toBe(true);
    expect(outcome.reason).toBe("no_context");

    const { data: ticket } = await admin
      .from("tickets")
      .select("tenant_id, escalated")
      .eq("id", outcome.ticketId!)
      .single();
    expect(ticket?.tenant_id).toBe(tenantB);
    expect(ticket?.escalated).toBe(true);
  });

  it("ai_interactions/escalations are agents-only reads", async () => {
    // end-user A cannot read the audit tables...
    const a1 = await signIn(userA.email, userA.password);
    const { data: userView } = await a1.from("ai_interactions").select("id");
    expect(userView ?? []).toHaveLength(0);

    // ...but an agent in the same tenant can.
    const ag = await signIn(agentA.email, agentA.password);
    const { data: agentView } = await ag.from("ai_interactions").select("id");
    expect((agentView ?? []).length).toBeGreaterThan(0);

    // and another tenant sees none of A's interactions.
    const b = await signIn(userB.email, userB.password);
    const { data: crossView } = await b
      .from("ai_interactions")
      .select("id")
      .eq("tenant_id", tenantA);
    expect(crossView ?? []).toHaveLength(0);
  });
});
