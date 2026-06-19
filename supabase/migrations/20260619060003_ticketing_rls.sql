-- Phase 2: Row-Level Security for ticketing.

-- ---- helpers ----------------------------------------------------------------

-- True when the caller's role is agent or higher (sees the whole tenant queue).
create or replace function app.is_agent_or_above()
returns boolean
language sql
stable
set search_path = ''
as $$
  select app.current_user_role() in ('owner', 'admin', 'agent');
$$;

-- True when the caller may access a given ticket: agents+ see all tenant tickets;
-- end-users see only tickets they requested. SECURITY DEFINER so message
-- policies can check ticket access without recursive RLS, but it always scopes
-- to the caller's tenant.
create or replace function app.can_access_ticket(p_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tickets t
    where t.id = p_ticket_id
      and t.tenant_id = app.current_tenant_id()
      and (app.is_agent_or_above() or t.requester_id = (select auth.uid()))
  );
$$;

grant execute on function app.is_agent_or_above() to anon, authenticated, service_role;
grant execute on function app.can_access_ticket(uuid) to anon, authenticated, service_role;

-- ---- tickets ----------------------------------------------------------------
alter table public.tickets enable row level security;
alter table public.tickets force row level security;

-- Read: agents+ see the tenant queue; end-users see only their own tickets.
create policy tickets_select on public.tickets
  for select to authenticated
  using (
    tenant_id = app.current_tenant_id()
    and (app.is_agent_or_above() or requester_id = (select auth.uid()))
  );

-- Create: within the caller's tenant. End-users may only file as themselves;
-- agents+ may file on behalf of any member of their tenant.
create policy tickets_insert on public.tickets
  for insert to authenticated
  with check (
    tenant_id = app.current_tenant_id()
    and (app.is_agent_or_above() or requester_id = (select auth.uid()))
  );

-- Update: agents+ only (status/assignment/priority). tenant_id pinned to the
-- caller's tenant on both sides so a row can't be moved across tenants.
create policy tickets_update on public.tickets
  for update to authenticated
  using (tenant_id = app.current_tenant_id() and app.is_agent_or_above())
  with check (tenant_id = app.current_tenant_id() and app.is_agent_or_above());

-- No delete policy: tickets are closed, never deleted by app roles.

-- ---- ticket_messages --------------------------------------------------------
alter table public.ticket_messages enable row level security;
alter table public.ticket_messages force row level security;

-- Read: any message on a ticket the caller can access.
create policy ticket_messages_select on public.ticket_messages
  for select to authenticated
  using (
    tenant_id = app.current_tenant_id()
    and app.can_access_ticket(ticket_id)
  );

-- Create: caller posts as themselves on an accessible ticket; author_type must
-- match their role. AI/system messages are inserted by trusted code (service
-- role, which bypasses RLS) and are not expressible here.
create policy ticket_messages_insert on public.ticket_messages
  for insert to authenticated
  with check (
    tenant_id = app.current_tenant_id()
    and app.can_access_ticket(ticket_id)
    and author_id = (select auth.uid())
    and author_type = (
      case when app.is_agent_or_above() then 'agent' else 'end_user' end
    )::public.message_author_type
  );

-- No update/delete policies: messages are immutable for app roles.

-- ---- grants -----------------------------------------------------------------
revoke all on public.tickets         from anon;
revoke all on public.ticket_messages from anon;

grant select, insert, update on public.tickets         to authenticated;
grant select, insert          on public.ticket_messages to authenticated;

grant all on public.tickets         to service_role;
grant all on public.ticket_messages to service_role;
