import { getTenantDb } from "@/lib/db/with-tenant";
import type { UserProfile } from "@/types/database";

/** Agents/admins/owners in the caller's tenant — candidates for assignment. */
export async function listAssignableAgents(): Promise<UserProfile[]> {
  const db = await getTenantDb();
  const { data, error } = await db.raw
    .from("users")
    .select("*")
    .eq("tenant_id", db.ctx.tenantId)
    .in("role", ["owner", "admin", "agent"])
    .order("display_name", { ascending: true });
  if (error) throw new Error(`Failed to list agents: ${error.message}`);
  return data ?? [];
}
