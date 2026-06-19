-- Phase 2 polish: create a ticket and its first message atomically (one
-- transaction). SECURITY INVOKER so RLS still governs the inserts — the caller
-- can only create within their own tenant and as themselves. author_type is
-- derived from the caller's role, never trusted from input.
create or replace function public.create_ticket_with_message(
  p_subject text,
  p_body text,
  p_priority public.ticket_priority default 'normal'::public.ticket_priority,
  p_channel public.ticket_channel default 'portal'::public.ticket_channel
)
returns public.tickets
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ticket public.tickets;
  v_author public.message_author_type;
begin
  insert into public.tickets (tenant_id, requester_id, subject, priority, channel)
  values (
    app.current_tenant_id(),
    (select auth.uid()),
    p_subject,
    p_priority,
    p_channel
  )
  returning * into v_ticket;

  v_author := case when app.is_agent_or_above() then 'agent' else 'end_user' end;

  insert into public.ticket_messages (tenant_id, ticket_id, author_type, author_id, body)
  values (v_ticket.tenant_id, v_ticket.id, v_author, (select auth.uid()), p_body);

  return v_ticket;
end;
$$;

grant execute on function public.create_ticket_with_message(
  text, text, public.ticket_priority, public.ticket_channel
) to authenticated;
