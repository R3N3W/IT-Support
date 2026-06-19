-- Phase 2 polish: allow a ticket's requester to reopen/close their OWN ticket,
-- without a SECURITY DEFINER bypass (force RLS blocks that) and without letting
-- them edit other columns (RLS can't do column-level limits). Approach:
--   1) an additional UPDATE policy scoping requesters to their own tickets, and
--   2) extend the immutable-column trigger so non-agent callers may only change
--      `status`, and only to 'open' or 'closed'.

create policy tickets_update_own_by_requester on public.tickets
  for update to authenticated
  using (
    tenant_id = app.current_tenant_id()
    and requester_id = (select auth.uid())
  )
  with check (
    tenant_id = app.current_tenant_id()
    and requester_id = (select auth.uid())
  );

create or replace function app.tickets_protect_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- NOTE: this trigger must remain SECURITY INVOKER. The current_user and
  -- app.is_agent_or_above() checks below assume it runs as the calling role; a
  -- SECURITY DEFINER caller would make current_user the definer and silently
  -- disable the requester column protection.
  if current_user = 'authenticated' then
    -- Structural/identity columns are immutable for all app roles.
    if new.id <> old.id
       or new.tenant_id <> old.tenant_id
       or new.requester_id <> old.requester_id
       or new.created_at <> old.created_at then
      raise exception 'ticket immutable column (id/tenant_id/requester_id/created_at) may not be changed';
    end if;

    -- Non-agents (the requester, via tickets_update_own_by_requester) may only
    -- toggle status, and only between open and closed.
    if not app.is_agent_or_above() then
      if new.subject <> old.subject
         or new.priority <> old.priority
         or new.channel <> old.channel
         or new.ai_handled <> old.ai_handled
         or new.escalated <> old.escalated
         or coalesce(new.assignee_id::text, '') <> coalesce(old.assignee_id::text, '') then
        raise exception 'requester may only change ticket status';
      end if;
      if new.status <> old.status and new.status not in ('open', 'closed') then
        raise exception 'requester may only set status to open or closed';
      end if;
    end if;
  end if;
  return new;
end;
$$;
