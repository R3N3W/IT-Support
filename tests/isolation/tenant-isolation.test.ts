import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  provisionTenant,
  createTenantUser,
} from "@/lib/provisioning/provision-tenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * The critical suite: prove that one tenant can NEVER read or write another
 * tenant's data. Runs against the real Supabase project, exercising the actual
 * RLS policies with real user JWTs.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (for provisioning + cleanup). Without it
 * the suite is skipped with a warning rather than failing.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!hasServiceKey) {
  console.warn(
    "[tenant-isolation] SUPABASE_SERVICE_ROLE_KEY not set — skipping. " +
      "Add it to .env.local to run the isolation suite.",
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

describe.runIf(hasServiceKey)("cross-tenant isolation", () => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const ownerA = { email: `owner-a-${suffix}@example.test`, password: "Aa!12345678" };
  const ownerB = { email: `owner-b-${suffix}@example.test`, password: "Bb!12345678" };
  const agentA = { email: `agent-a-${suffix}@example.test`, password: "Cc!12345678" };

  let tenantA = "";
  let tenantB = "";
  let ownerAId = "";
  let ownerBId = "";
  let agentAId = "";

  beforeAll(async () => {
    const a = await provisionTenant({
      tenantName: "Tenant A",
      tenantSlug: `tenant-a-${suffix}`,
      ownerEmail: ownerA.email,
      ownerPassword: ownerA.password,
      ownerDisplayName: "Owner A",
    });
    tenantA = a.tenantId;
    ownerAId = a.ownerUserId;

    const b = await provisionTenant({
      tenantName: "Tenant B",
      tenantSlug: `tenant-b-${suffix}`,
      ownerEmail: ownerB.email,
      ownerPassword: ownerB.password,
      ownerDisplayName: "Owner B",
    });
    tenantB = b.tenantId;
    ownerBId = b.ownerUserId;

    const ag = await createTenantUser({
      tenantId: tenantA,
      email: agentA.email,
      password: agentA.password,
      role: "agent",
      displayName: "Agent A",
    });
    agentAId = ag.userId;
  });

  afterAll(async () => {
    if (!hasServiceKey) return;
    const admin = createSupabaseAdminClient();
    for (const id of [ownerAId, ownerBId, agentAId]) {
      if (id) await admin.auth.admin.deleteUser(id).catch(() => {});
    }
    for (const t of [tenantA, tenantB]) {
      if (t) await admin.from("tenants").delete().eq("id", t);
    }
  });

  it("an owner sees only their own tenant row", async () => {
    const a = await signIn(ownerA.email, ownerA.password);
    const { data, error } = await a.from("tenants").select("id");
    expect(error).toBeNull();
    expect(data?.map((r) => r.id)).toEqual([tenantA]);
  });

  it("an owner cannot read another tenant even by explicit id", async () => {
    const a = await signIn(ownerA.email, ownerA.password);
    const { data } = await a.from("tenants").select("id").eq("id", tenantB);
    expect(data ?? []).toHaveLength(0);
  });

  it("an owner sees only users within their own tenant", async () => {
    const a = await signIn(ownerA.email, ownerA.password);
    const { data, error } = await a.from("users").select("id, tenant_id");
    expect(error).toBeNull();
    expect(data && data.length).toBeGreaterThan(0);
    expect(data?.every((u) => u.tenant_id === tenantA)).toBe(true);
    expect(data?.some((u) => u.id === ownerBId)).toBe(false);
  });

  it("tenant B cannot see any of tenant A's users", async () => {
    const b = await signIn(ownerB.email, ownerB.password);
    const { data } = await b
      .from("users")
      .select("id")
      .eq("tenant_id", tenantA);
    expect(data ?? []).toHaveLength(0);
  });

  it("a tenant member cannot insert a tenant (no write policy/grant)", async () => {
    const a = await signIn(ownerA.email, ownerA.password);
    const { error } = await a
      .from("tenants")
      .insert({ name: "Rogue", slug: `rogue-${suffix}` });
    expect(error).not.toBeNull();
  });

  it("a member cannot escalate their own role", async () => {
    const agent = await signIn(agentA.email, agentA.password);
    const { error } = await agent
      .from("users")
      .update({ role: "owner" })
      .eq("id", agentAId);
    expect(error).not.toBeNull();

    // Confirm the role is unchanged from a trusted vantage point.
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("users")
      .select("role")
      .eq("id", agentAId)
      .single();
    expect(data?.role).toBe("agent");
  });

  it("an anonymous client leaks no tenant or user rows", async () => {
    const anon = anonClient();
    const { data: tenants } = await anon.from("tenants").select("id");
    const { data: users } = await anon.from("users").select("id");
    expect(tenants ?? []).toHaveLength(0);
    expect(users ?? []).toHaveLength(0);
  });
});
