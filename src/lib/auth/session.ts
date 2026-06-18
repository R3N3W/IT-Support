import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

/**
 * The verified identity of the current caller, derived entirely from the
 * server-validated JWT (auth.getUser hits the auth server — it does not trust
 * cookies blindly). tenantId/role come from app_metadata claims, which are set
 * server-side at provisioning and are not client-writable.
 */
export interface TenantContext {
  userId: string;
  tenantId: string;
  role: UserRole;
  email: string | null;
}

/** Higher number = more privileged. Used for role-gate comparisons. */
const ROLE_RANK: Record<UserRole, number> = {
  end_user: 0,
  agent: 1,
  admin: 2,
  owner: 3,
};

/**
 * Returns the current tenant context, or null if there is no authenticated,
 * tenant-bound user. Never throws.
 */
export async function getTenantContext(): Promise<TenantContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const appMeta = (user.app_metadata ?? {}) as {
    tenant_id?: string;
    role?: UserRole;
  };

  // A user with no tenant binding is treated as unauthenticated for our
  // purposes — every tenant-scoped operation requires both claims.
  if (!appMeta.tenant_id || !appMeta.role) return null;

  return {
    userId: user.id,
    tenantId: appMeta.tenant_id,
    role: appMeta.role,
    email: user.email ?? null,
  };
}

/** Like getTenantContext, but throws UNAUTHENTICATED when there is no user. */
export async function requireUser(): Promise<TenantContext> {
  const ctx = await getTenantContext();
  if (!ctx) throw new Error("UNAUTHENTICATED");
  return ctx;
}

/** Throws FORBIDDEN when the caller's role is below the required minimum. */
export async function requireRole(minimum: UserRole): Promise<TenantContext> {
  const ctx = await requireUser();
  if (ROLE_RANK[ctx.role] < ROLE_RANK[minimum]) {
    throw new Error("FORBIDDEN");
  }
  return ctx;
}

export function hasAtLeastRole(role: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
