import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";

/**
 * Tenant provisioning. This is a TRUSTED operation: it uses the service-role
 * client (bypasses RLS) and writes the tenant_id/role claims into the new
 * user's app_metadata so RLS will scope every future request. Run only from
 * trusted server contexts (an onboarding action or admin script), never from
 * client-reachable code without an authorization check in front of it.
 */
export interface ProvisionTenantInput {
  tenantName: string;
  tenantSlug: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerDisplayName?: string;
  plan?: string;
}

export interface ProvisionTenantResult {
  tenantId: string;
  ownerUserId: string;
}

export async function provisionTenant(
  input: ProvisionTenantInput,
): Promise<ProvisionTenantResult> {
  const admin = createSupabaseAdminClient();

  // 1. Create the tenant row.
  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .insert({
      name: input.tenantName,
      slug: input.tenantSlug,
      plan: input.plan ?? "free",
    })
    .select("id")
    .single();

  if (tenantError || !tenant) {
    throw new Error(`Failed to create tenant: ${tenantError?.message}`);
  }
  const tenantId = tenant.id;

  // 2. Create the owner auth user with tenant claims baked into app_metadata.
  //    The on_auth_user_created trigger mirrors a row into public.users.
  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email: input.ownerEmail,
    password: input.ownerPassword,
    email_confirm: true,
    app_metadata: { tenant_id: tenantId, role: "owner" satisfies UserRole },
    user_metadata: input.ownerDisplayName
      ? { display_name: input.ownerDisplayName }
      : undefined,
  });

  if (userError || !created.user) {
    // Best-effort rollback so we don't leave an orphan tenant behind.
    await admin.from("tenants").delete().eq("id", tenantId);
    throw new Error(`Failed to create owner user: ${userError?.message}`);
  }

  // 3. Make sure the profile row reflects the display name (the trigger only
  //    copies id/tenant_id/role/email).
  const { error: profileError } = await admin.from("users").upsert({
    id: created.user.id,
    tenant_id: tenantId,
    role: "owner",
    email: input.ownerEmail,
    display_name: input.ownerDisplayName ?? null,
  });

  if (profileError) {
    // Roll back fully so a failed step 3 cannot leave an orphaned auth user +
    // tenant behind. Deleting the auth user cascades to its public.users row.
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
    await admin.from("tenants").delete().eq("id", tenantId);
    throw new Error(`Failed to write owner profile: ${profileError.message}`);
  }

  return { tenantId, ownerUserId: created.user.id };
}

/**
 * Adds an additional user to an existing tenant with a given role. Trusted
 * (service-role) operation, used by admin user management and tests.
 */
export interface CreateTenantUserInput {
  tenantId: string;
  email: string;
  password: string;
  role: UserRole;
  displayName?: string;
}

export async function createTenantUser(
  input: CreateTenantUserInput,
): Promise<{ userId: string }> {
  const admin = createSupabaseAdminClient();

  const { data: created, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    app_metadata: { tenant_id: input.tenantId, role: input.role },
    user_metadata: input.displayName
      ? { display_name: input.displayName }
      : undefined,
  });

  if (error || !created.user) {
    throw new Error(`Failed to create tenant user: ${error?.message}`);
  }

  // Don't rely on the handle_new_user trigger: the admin API sets app_metadata
  // after the initial auth.users insert, so the AFTER INSERT trigger may not see
  // the tenant binding. Write the profile row explicitly (idempotent).
  const { error: profileError } = await admin.from("users").upsert({
    id: created.user.id,
    tenant_id: input.tenantId,
    role: input.role,
    email: input.email,
    display_name: input.displayName ?? null,
  });
  if (profileError) {
    throw new Error(`Failed to write user profile: ${profileError.message}`);
  }

  return { userId: created.user.id };
}
