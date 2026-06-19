import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  provisionTenant,
  createTenantUser,
} from "@/lib/provisioning/provision-tenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Cross-tenant + role isolation for tickets and messages, exercised with real
 * user JWTs against the live RLS policies. Requires SUPABASE_SERVICE_ROLE_KEY
 * (provisioning + cleanup); skipped otherwise.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!hasServiceKey) {
  console.warn(
    "[ticket-isolation] SUPABASE_SERVICE_ROLE_KEY not set — skipping.",
  );
}

function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(
  email: string,
  password: string,
): Promise<SupabaseClient<Database>> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return client;
}

describe.runIf(hasServiceKey)("ticket cross-tenant + role isolation", () => {
  const s = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const pw = "Tt!12345678";
  const ownerA = { email: `tk-ownerA-${s}@example.test`, password: pw };
  const agentA = { email: `tk-agentA-${s}@example.test`, password: pw };
  const userA1 = { email: `tk-userA1-${s}@example.test`, password: pw };
  const userA2 = { email: `tk-userA2-${s}@example.test`, password: pw };
  const ownerB = { email: `tk-ownerB-${s}@example.test`, password: pw };

  let tenantA = "";
  let tenantB = "";
  const ids: string[] = [];
  let agentAId = "";
  let userA1Id = "";
  let ticketId = "";

  beforeAll(async () => {
    const a = await provisionTenant({
      tenantName: "TK A",
      tenantSlug: `tk-a-${s}`,
      ownerEmail: ownerA.email,
      ownerPassword: ownerA.password,
    });
    tenantA = a.tenantId;
    ids.push(a.ownerUserId);

    const b = await provisionTenant({
      tenantName: "TK B",
      tenantSlug: `tk-b-${s}`,
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

    const u1 = await createTenantUser({
      tenantId: tenantA,
      email: userA1.email,
      password: userA1.password,
      role: "end_user",
    });
    userA1Id = u1.userId;
    ids.push(u1.userId);

    const u2 = await createTenantUser({
      tenantId: tenantA,
      email: userA2.email,
      password: userA2.password,
      role: "end_user",
    });
    ids.push(u2.userId);

    // end-user A1 files a ticket (exercises the INSERT policy).
    const a1 = await signIn(userA1.email, userA1.password);
    const { data, error } = await a1
      .from("tickets")
      .insert({
        tenant_id: tenantA,
        requester_id: userA1Id,
        subject: "Printer offline",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`A1 ticket insert failed: ${error?.message}`);
    ticketId = data.id;
  });

  afterAll(async () => {
    if (!hasServiceKey) return;
    const admin = createSupabaseAdminClient();
    for (const id of ids) await admin.auth.admin.deleteUser(id).catch(() => {});
    for (const t of [tenantA, tenantB]) {
      if (t) await admin.from("tenants").delete().eq("id", t);
    }
  });

  it("requester sees their own ticket", async () => {
    const a1 = await signIn(userA1.email, userA1.password);
    const { data } = await a1.from("tickets").select("id");
    expect(data?.map((t) => t.id)).toEqual([ticketId]);
  });

  it("another end-user in the same tenant cannot see it", async () => {
    const a2 = await signIn(userA2.email, userA2.password);
    const { data: all } = await a2.from("tickets").select("id");
    expect(all ?? []).toHaveLength(0);
    const { data: byId } = await a2
      .from("tickets")
      .select("id")
      .eq("id", ticketId);
    expect(byId ?? []).toHaveLength(0);
  });

  it("an agent sees the whole tenant queue", async () => {
    const ag = await signIn(agentA.email, agentA.password);
    const { data } = await ag.from("tickets").select("id").eq("id", ticketId);
    expect(data?.map((t) => t.id)).toEqual([ticketId]);
  });

  it("another tenant's owner cannot see it", async () => {
    const b = await signIn(ownerB.email, ownerB.password);
    const { data } = await b.from("tickets").select("id").eq("id", ticketId);
    expect(data ?? []).toHaveLength(0);
  });

  it("a requester can close/reopen their own ticket, but not set agent statuses or other fields", async () => {
    const a1 = await signIn(userA1.email, userA1.password);
    const admin = createSupabaseAdminClient();

    // Requester can close their own ticket.
    await a1.from("tickets").update({ status: "closed" }).eq("id", ticketId);
    let snap = await admin
      .from("tickets")
      .select("status, priority")
      .eq("id", ticketId)
      .single();
    expect(snap.data?.status).toBe("closed");

    // Requester cannot set an agent-only status (trigger rejects).
    const resStatus = await a1
      .from("tickets")
      .update({ status: "resolved" })
      .eq("id", ticketId);
    expect(resStatus.error).not.toBeNull();

    // Requester cannot change other columns (trigger rejects).
    const resPriority = await a1
      .from("tickets")
      .update({ priority: "low" })
      .eq("id", ticketId);
    expect(resPriority.error).not.toBeNull();

    // Reopen, and confirm nothing else changed.
    await a1.from("tickets").update({ status: "open" }).eq("id", ticketId);
    snap = await admin
      .from("tickets")
      .select("status, priority")
      .eq("id", ticketId)
      .single();
    expect(snap.data?.status).toBe("open");
    expect(snap.data?.priority).toBe("normal");
  });

  it("an agent can change ticket status", async () => {
    const ag = await signIn(agentA.email, agentA.password);
    const { error } = await ag
      .from("tickets")
      .update({ status: "resolved" })
      .eq("id", ticketId);
    expect(error).toBeNull();

    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("tickets")
      .select("status")
      .eq("id", ticketId)
      .single();
    expect(data?.status).toBe("resolved");
  });

  it("an agent cannot rewrite a ticket's requester (immutable column)", async () => {
    const ag = await signIn(agentA.email, agentA.password);
    const { error } = await ag
      .from("tickets")
      .update({ requester_id: agentAId })
      .eq("id", ticketId);
    expect(error).not.toBeNull();

    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("tickets")
      .select("requester_id")
      .eq("id", ticketId)
      .single();
    expect(data?.requester_id).toBe(userA1Id);
  });

  it("a non-requester cannot post a message on the ticket", async () => {
    const a2 = await signIn(userA2.email, userA2.password);
    const { error } = await a2.from("ticket_messages").insert({
      tenant_id: tenantA,
      ticket_id: ticketId,
      author_type: "end_user",
      author_id: userA1Id, // even spoofing the author id must fail
      body: "peek",
    });
    expect(error).not.toBeNull();
  });

  it("a user cannot file a ticket into another tenant", async () => {
    const a1 = await signIn(userA1.email, userA1.password);
    const { error } = await a1.from("tickets").insert({
      tenant_id: tenantB,
      requester_id: userA1Id,
      subject: "cross-tenant",
    });
    expect(error).not.toBeNull();
  });

  it("an anonymous client sees no tickets or messages", async () => {
    const anon = anonClient();
    const { data: tickets } = await anon.from("tickets").select("id");
    const { data: messages } = await anon.from("ticket_messages").select("id");
    expect(tickets ?? []).toHaveLength(0);
    expect(messages ?? []).toHaveLength(0);
  });
});
