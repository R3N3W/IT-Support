-- Supabase's default privileges grant ALL on public tables to anon/authenticated,
-- including DELETE and TRUNCATE (TRUNCATE bypasses RLS entirely). RLS already
-- fails closed, but reduce to least privilege so a future stray policy or direct
-- connection cannot open an unintended write/destroy path. Addresses the Phase 1
-- review's M1. service_role keeps its full access (used by trusted code only).

revoke all on public.tenants         from anon, authenticated;
revoke all on public.users           from anon, authenticated;
revoke all on public.tickets         from anon, authenticated;
revoke all on public.ticket_messages from anon, authenticated;

-- Re-grant exactly what each surface needs (rows still constrained by RLS).
grant select                 on public.tenants         to authenticated;
grant select                 on public.users           to authenticated;
grant select, insert, update on public.tickets         to authenticated;
grant select, insert         on public.ticket_messages to authenticated;
