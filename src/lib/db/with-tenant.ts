import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";

/** The exact RLS-bound server client type, inferred from the factory. */
type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

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
export async function getTenantDb() {
  const ctx = await requireUser();
  const raw: ServerClient = await createSupabaseServerClient();

  return {
    ctx,
    /** Escape hatch to the underlying RLS-constrained client. Use sparingly. */
    raw,
    /** SELECT * pre-filtered by the caller's tenant_id. Chain further filters. */
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
