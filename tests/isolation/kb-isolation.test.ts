import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  provisionTenant,
  createTenantUser,
} from "@/lib/provisioning/provision-tenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { enqueueEmbedArticle, processDueJobs } from "@/lib/jobs/queue";

/**
 * KB cross-tenant + role isolation, plus the ingestion/job pipeline end to end
 * (with the stub embeddings provider). Requires SUPABASE_SERVICE_ROLE_KEY.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!hasServiceKey) {
  console.warn("[kb-isolation] SUPABASE_SERVICE_ROLE_KEY not set — skipping.");
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

describe.runIf(hasServiceKey)("kb cross-tenant + role isolation", () => {
  const s = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const pw = "Kb!12345678";
  const ownerA = { email: `kb-ownerA-${s}@example.test`, password: pw };
  const agentA = { email: `kb-agentA-${s}@example.test`, password: pw };
  const userA = { email: `kb-userA-${s}@example.test`, password: pw };
  const ownerB = { email: `kb-ownerB-${s}@example.test`, password: pw };
  const agentB = { email: `kb-agentB-${s}@example.test`, password: pw };

  let tenantA = "";
  let tenantB = "";
  const ids: string[] = [];
  let agentAId = "";
  let publishedId = "";
  let draftId = "";

  beforeAll(async () => {
    const a = await provisionTenant({
      tenantName: "KB A",
      tenantSlug: `kb-a-${s}`,
      ownerEmail: ownerA.email,
      ownerPassword: ownerA.password,
    });
    tenantA = a.tenantId;
    ids.push(a.ownerUserId);

    const b = await provisionTenant({
      tenantName: "KB B",
      tenantSlug: `kb-b-${s}`,
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
    agentAId = ag.userId;
    ids.push(ag.userId);

    const u = await createTenantUser({
      tenantId: tenantA,
      email: userA.email,
      password: userA.password,
      role: "end_user",
    });
    ids.push(u.userId);

    const agB = await createTenantUser({
      tenantId: tenantB,
      email: agentB.email,
      password: agentB.password,
      role: "agent",
    });
    ids.push(agB.userId);

    const agent = await signIn(agentA.email, agentA.password);

    const published = await agent
      .from("kb_articles")
      .insert({
        tenant_id: tenantA,
        title: "Reset your password",
        body: "Open settings.\n\nClick reset password.\n\nCheck your email.",
        status: "published",
        created_by: agentAId,
      })
      .select("id")
      .single();
    if (published.error || !published.data) {
      throw new Error(`publish insert failed: ${published.error?.message}`);
    }
    publishedId = published.data.id;

    const draft = await agent
      .from("kb_articles")
      .insert({
        tenant_id: tenantA,
        title: "Internal runbook (draft)",
        body: "Not ready yet.",
        created_by: agentAId,
      })
      .select("id")
      .single();
    if (draft.error || !draft.data) {
      throw new Error(`draft insert failed: ${draft.error?.message}`);
    }
    draftId = draft.data.id;

    // Drive the ingestion pipeline through the job queue.
    await enqueueEmbedArticle(tenantA, publishedId);
    await processDueJobs();
  });

  afterAll(async () => {
    if (!hasServiceKey) return;
    const admin = createSupabaseAdminClient();
    for (const id of ids) await admin.auth.admin.deleteUser(id).catch(() => {});
    for (const t of [tenantA, tenantB]) {
      if (t) await admin.from("tenants").delete().eq("id", t);
    }
  });

  it("ingestion created embedded chunks for the published article", async () => {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("kb_chunks")
      .select("embedding, embedding_model")
      .eq("article_id", publishedId);
    expect((data ?? []).length).toBeGreaterThan(0);
    expect(data?.every((c) => c.embedding !== null)).toBe(true);
    expect(data?.every((c) => c.embedding_model !== null)).toBe(true);
  });

  it("the embed job succeeded", async () => {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("jobs")
      .select("status, type")
      .eq("tenant_id", tenantA);
    expect(data?.some((j) => j.type === "embed_article" && j.status === "succeeded")).toBe(true);
  });

  it("an agent sees all their tenant's articles and chunks", async () => {
    const agent = await signIn(agentA.email, agentA.password);
    const { data: articles } = await agent.from("kb_articles").select("id");
    const ids2 = (articles ?? []).map((a) => a.id);
    expect(ids2).toContain(publishedId);
    expect(ids2).toContain(draftId);

    const { data: chunks } = await agent.from("kb_chunks").select("id");
    expect((chunks ?? []).length).toBeGreaterThan(0);
  });

  it("an end-user sees only published articles", async () => {
    const user = await signIn(userA.email, userA.password);
    const { data } = await user.from("kb_articles").select("id, status");
    const ids2 = (data ?? []).map((a) => a.id);
    expect(ids2).toContain(publishedId);
    expect(ids2).not.toContain(draftId);
    expect((data ?? []).every((a) => a.status === "published")).toBe(true);
  });

  it("an end-user cannot read chunks or create articles", async () => {
    const user = await signIn(userA.email, userA.password);
    const { data: chunks } = await user.from("kb_chunks").select("id");
    expect(chunks ?? []).toHaveLength(0);

    const { error } = await user.from("kb_articles").insert({
      tenant_id: tenantA,
      title: "rogue",
      body: "x",
      created_by: agentAId,
    });
    expect(error).not.toBeNull();
  });

  it("another tenant cannot see tenant A's KB or jobs", async () => {
    const other = await signIn(agentB.email, agentB.password);
    const { data: articles } = await other
      .from("kb_articles")
      .select("id")
      .eq("tenant_id", tenantA);
    const { data: chunks } = await other
      .from("kb_chunks")
      .select("id")
      .eq("tenant_id", tenantA);
    const { data: jobs } = await other
      .from("jobs")
      .select("id")
      .eq("tenant_id", tenantA);
    expect(articles ?? []).toHaveLength(0);
    expect(chunks ?? []).toHaveLength(0);
    expect(jobs ?? []).toHaveLength(0);
  });

  it("an agent cannot create an article in another tenant", async () => {
    const agent = await signIn(agentA.email, agentA.password);
    const { error } = await agent.from("kb_articles").insert({
      tenant_id: tenantB,
      title: "cross-tenant article",
      body: "should be rejected",
      created_by: agentAId,
    });
    expect(error).not.toBeNull();
  });

  it("an anonymous client sees no KB rows", async () => {
    const anon = anonClient();
    const { data: articles } = await anon.from("kb_articles").select("id");
    const { data: chunks } = await anon.from("kb_chunks").select("id");
    expect(articles ?? []).toHaveLength(0);
    expect(chunks ?? []).toHaveLength(0);
  });
});
