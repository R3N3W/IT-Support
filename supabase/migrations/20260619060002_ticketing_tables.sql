-- Phase 2: ticketing tables.

-- Composite-unique target so child tables can reference (id, tenant_id) and get
-- a DB-enforced guarantee that related rows share the same tenant.
alter table public.users add constraint users_id_tenant_key unique (id, tenant_id);

-- Guard: an assignee must belong to the ticket's tenant. (Composite FK can't be
-- used for assignee because ON DELETE SET NULL would null tenant_id too, so we
-- validate via trigger and keep a single-column FK with ON DELETE SET NULL.)
create or replace function app.tickets_check_assignee_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assignee_id is not null then
    if not exists (
      select 1 from public.users u
      where u.id = new.assignee_id and u.tenant_id = new.tenant_id
    ) then
      raise exception 'assignee % is not a member of tenant %',
        new.assignee_id, new.tenant_id;
    end if;
  end if;
  return new;
end;
$$;

create table public.tickets (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  requester_id  uuid not null,
  assignee_id   uuid references public.users (id) on delete set null,
  subject       text not null,
  status        public.ticket_status   not null default 'open',
  priority      public.ticket_priority not null default 'normal',
  channel       public.ticket_channel  not null default 'portal',
  ai_handled    boolean not null default false,
  escalated     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- requester must be a user in the SAME tenant (DB-enforced, not just RLS).
  constraint tickets_requester_fk foreign key (requester_id, tenant_id)
    references public.users (id, tenant_id) on delete cascade,
  -- composite-unique target for ticket_messages -> tickets same-tenant FK.
  constraint tickets_id_tenant_key unique (id, tenant_id)
);

comment on table public.tickets is 'Support tickets. tenant_id is the isolation key; requester/assignee are same-tenant by FK/trigger.';

create index tickets_tenant_idx           on public.tickets (tenant_id);
create index tickets_tenant_status_idx    on public.tickets (tenant_id, status);
create index tickets_tenant_assignee_idx  on public.tickets (tenant_id, assignee_id);
create index tickets_tenant_requester_idx on public.tickets (tenant_id, requester_id);
create index tickets_tenant_created_idx   on public.tickets (tenant_id, created_at desc);

create table public.ticket_messages (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  ticket_id    uuid not null,
  author_type  public.message_author_type not null,
  author_id    uuid references public.users (id) on delete set null,
  body         text not null,
  created_at   timestamptz not null default now(),
  -- message belongs to a ticket in the SAME tenant (DB-enforced).
  constraint ticket_messages_ticket_fk foreign key (ticket_id, tenant_id)
    references public.tickets (id, tenant_id) on delete cascade
);

comment on table public.ticket_messages is 'Thread messages on a ticket. Immutable; author_type/author_id set by RLS or trusted code.';

create index ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);
create index ticket_messages_tenant_idx on public.ticket_messages (tenant_id);

create trigger tickets_set_updated_at
  before update on public.tickets
  for each row execute function app.set_updated_at();

create trigger tickets_assignee_tenant_guard
  before insert or update on public.tickets
  for each row execute function app.tickets_check_assignee_tenant();
