import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser, type TenantContext } from "@/lib/auth/session";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Tables that carry a tenant_id and must always be tenant-scoped. As new
 * tenant-owned tables are added in later phases (tickets, kb_articles, ...),
 * extend this union so the DAL keeps enforcing the filter at the type level.
 */
type TenantScopedTable = "users";

/**
 * The sanctioned tenant-scoped data-access layer. Every read/write of tenant
 * data should go through this. It is defense-in-depth: RLS already isolates
 * tenants in the database, and this layer adds an explicit tenant_id predicate
 * on top so a missing/incorrect policy can never silently leak data, and so the
 * query planner uses the tenant-leading indexes.
 *
 * Raw service-role access (which bypasses RLS) is reserved for provisioning and
 * background jobs and must never be used here.
 */
export interface TenantDb {
  ctx: TenantContext;
  /** Escape hatch to the underlying RLS-constrained client. Use sparingly. */
  raw: SupabaseClient<Database>;
  /** SELECT * pre-filtered by the caller's tenant_id. Chain further filters. */
  select(table: TenantScopedTable): ReturnType<
    ReturnType<SupabaseClient<Database>["from"]>["select"]
  >;
}

export async function getTenantDb(): Promise<TenantDb> {
  const ctx = await requireUser();
  const raw = await createSupabaseServerClient();

  return {
    ctx,
    raw,
    select(table) {
      return raw.from(table).select("*").eq("tenant_id", ctx.tenantId);
    },
  };
}

/**
 * Convenience wrapper: resolves the tenant DAL and hands it to `fn`. Keeps call
 * sites from forgetting the tenant scoping.
 */
export async function withTenant<T>(
  fn: (db: TenantDb) => Promise<T>,
): Promise<T> {
  const db = await getTenantDb();
  return fn(db);
}
