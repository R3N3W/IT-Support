-- Phase 1: Row-Level Security. Isolation is enforced HERE, in the database.

-- ---- tenants ----------------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.tenants force row level security;

-- A caller may read only their own tenant row.
create policy tenants_select_own on public.tenants
  for select
  to authenticated
  using (id = app.current_tenant_id());

-- No insert/update/delete policies: tenant lifecycle is a trusted (service-role)
-- operation that bypasses RLS. Normal roles can never write the tenants table.

-- ---- users ------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.users force row level security;

-- A caller may read users that belong to their own tenant.
create policy users_select_same_tenant on public.users
  for select
  to authenticated
  using (tenant_id = app.current_tenant_id());

-- No insert/update/delete policies in Phase 1: provisioning and user management
-- are trusted operations (service role). Admin-driven user management arrives in
-- a later phase with role-scoped write policies.

-- ---- grants -----------------------------------------------------------------
-- Lock anon out entirely; these tables are never reachable without a session.
revoke all on public.tenants from anon;
revoke all on public.users   from anon;

-- Authenticated callers can read (RLS still constrains rows). No table-level
-- write grants; writes go through the service role only.
grant select on public.tenants to authenticated;
grant select on public.users   to authenticated;

-- Trusted server/job code (service role bypasses RLS) gets full access.
grant all on public.tenants to service_role;
grant all on public.users   to service_role;
