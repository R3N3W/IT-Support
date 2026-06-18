-- Phase 1: keep public.users in sync with auth.users.
-- When an auth user is created with tenant_id/role in app_metadata (set
-- server-side during provisioning), mirror a profile row into public.users.
-- SECURITY DEFINER so it can write the RLS-protected table; search_path is
-- pinned empty and every reference is schema-qualified (defensive).
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := nullif(new.raw_app_meta_data ->> 'tenant_id', '')::uuid;
  v_role public.user_role := coalesce(
    nullif(new.raw_app_meta_data ->> 'role', '')::public.user_role,
    'end_user'
  );
begin
  -- Only mirror once the user is bound to a tenant. Unbound users (created
  -- before tenant assignment) are mirrored later by the provisioning code.
  if v_tenant_id is not null then
    insert into public.users (id, tenant_id, role, email)
    values (new.id, v_tenant_id, v_role, new.email)
    on conflict (id) do update
      set tenant_id = excluded.tenant_id,
          role      = excluded.role,
          email     = excluded.email;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();
