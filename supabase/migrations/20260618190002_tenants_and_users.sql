-- Phase 1: core identity tables.

-- A tenant is a client company. It is NOT tenant-scoped: it *is* the tenant.
create table public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  plan        text not null default 'free',
  status      public.tenant_status not null default 'active',
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.tenants is 'Client companies. The root of every isolation boundary.';

-- Application-level mirror of auth.users, carrying tenant binding and role.
-- One row per authenticated principal; tenant_id is the isolation key.
create table public.users (
  id            uuid primary key references auth.users (id) on delete cascade,
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  role          public.user_role not null default 'end_user',
  email         text,
  display_name  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.users is 'Tenant-scoped profile for each auth user. tenant_id mirrors the JWT claim.';

-- Lead every tenant-scoped lookup with tenant_id.
create index users_tenant_id_idx on public.users (tenant_id);
create index users_tenant_role_idx on public.users (tenant_id, role);

create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function app.set_updated_at();

create trigger users_set_updated_at
  before update on public.users
  for each row execute function app.set_updated_at();
