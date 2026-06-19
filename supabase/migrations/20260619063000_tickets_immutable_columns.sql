-- Phase 2 hardening (security review MEDIUM): RLS gates who may update a ticket
-- but cannot restrict which columns. Lock the structural/identity columns
-- against app (authenticated) callers so an agent cannot re-attribute or backdate
-- a ticket. Trusted code (service_role) and migrations (postgres) are unaffected.
create or replace function app.tickets_protect_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if new.id <> old.id
       or new.tenant_id <> old.tenant_id
       or new.requester_id <> old.requester_id
       or new.created_at <> old.created_at then
      raise exception 'ticket immutable column (id/tenant_id/requester_id/created_at) may not be changed';
    end if;
  end if;
  return new;
end;
$$;

create trigger tickets_protect_immutable
  before update on public.tickets
  for each row execute function app.tickets_protect_immutable();
