-- Phase 1: helper schema, enums, and shared functions.
-- The `app` schema holds internal helpers and is NOT exposed via the API.
create schema if not exists app;

-- Roles within a tenant, from most to least privileged.
create type public.user_role as enum ('owner', 'admin', 'agent', 'end_user');

-- Lifecycle of a tenant (client company).
create type public.tenant_status as enum ('active', 'suspended', 'cancelled');

-- Current caller's tenant id, read from the verified JWT app_metadata claim.
-- Returns null when unauthenticated or the claim is absent (so RLS denies).
create or replace function app.current_tenant_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid;
$$;

-- Current caller's role, read from the verified JWT app_metadata claim.
create or replace function app.current_user_role()
returns public.user_role
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'role', '')::public.user_role;
$$;

-- Generic updated_at maintenance trigger.
create or replace function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Helpers are usable by all client roles (RLS evaluation needs them),
-- but the schema itself is not part of the exposed API surface.
grant usage on schema app to anon, authenticated, service_role;
grant execute on function app.current_tenant_id() to anon, authenticated, service_role;
grant execute on function app.current_user_role() to anon, authenticated, service_role;
