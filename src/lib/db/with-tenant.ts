import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Tables that carry a tenant_id and must always be tenant-scoped. As new
 * tenant-owned tables are added in later phases (kb_articles, ...), extend this
 * union so the DAL keeps enforcing the filter at the type level.
 */
type TenantScopedTable =
  | "users"
  | "tickets"
  | "ticket_messages"
  | "kb_articles"
  | "kb_chunks"
  | "jobs"
  | "escalations"
  | "ai_interactions";

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
export async function getTenantDb() {
  const ctx = await requireUser();
  // @supabase/ssr bundles its own (older) supabase-js types whose Insert/Update
  // payloads resolve to `never`. Cast to the installed supabase-js client type
  // so writes are correctly typed; the runtime object is unchanged.
  const raw = (await createSupabaseServerClient()) as unknown as SupabaseClient<Database>;

  return {
    ctx,
    /** Escape hatch to the underlying RLS-constrained client. Use sparingly. */
    raw,
    /** SELECT * pre-filtered by the caller's tenant_id, for simple same-tenant
     *  reads. For table-specific column filters/ordering, use `raw` directly
     *  with an explicit `.eq("tenant_id", ctx.tenantId)`. */
    select(table: TenantScopedTable) {
      return raw.from(table).select("*").eq("tenant_id", ctx.tenantId);
    },
  };
}

export type TenantDb = Awaited<ReturnType<typeof getTenantDb>>;

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
