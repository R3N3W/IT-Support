-- Phase 4: AI support agent — escalations + interaction log.
create type public.escalation_reason as enum (
  'low_confidence', 'no_context', 'user_request', 'policy'
);

create table public.escalations (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  ticket_id     uuid not null,
  reason        public.escalation_reason not null,
  ai_confidence real,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  -- escalation belongs to a ticket in the SAME tenant (DB-enforced).
  constraint escalations_ticket_fk foreign key (ticket_id, tenant_id)
    references public.tickets (id, tenant_id) on delete cascade
);

comment on table public.escalations is 'AI-to-human escalations; one per ticket handoff. Written by trusted code.';

create index escalations_tenant_idx on public.escalations (tenant_id);
create index escalations_ticket_idx on public.escalations (ticket_id);

create table public.ai_interactions (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants (id) on delete cascade,
  ticket_id           uuid references public.tickets (id) on delete set null,
  question            text not null,
  answer              text,
  retrieved_chunk_ids uuid[] not null default '{}',
  confidence          real,
  model               text,
  latency_ms          integer,
  escalated           boolean not null default false,
  escalation_reason   public.escalation_reason,
  token_usage         jsonb,
  created_at          timestamptz not null default now()
);

comment on table public.ai_interactions is 'Audit/eval log of every AI answer attempt. Written by trusted code; read by agents+.';

create index ai_interactions_tenant_idx on public.ai_interactions (tenant_id, created_at desc);

-- ---- RLS: agents+ may read within their tenant; writes are service-role only.
alter table public.escalations enable row level security;
alter table public.escalations force row level security;
create policy escalations_select on public.escalations
  for select to authenticated
  using (tenant_id = app.current_tenant_id() and app.is_agent_or_above());

alter table public.ai_interactions enable row level security;
alter table public.ai_interactions force row level security;
create policy ai_interactions_select on public.ai_interactions
  for select to authenticated
  using (tenant_id = app.current_tenant_id() and app.is_agent_or_above());

-- ---- least-privilege grants
revoke all on public.escalations     from anon, authenticated;
revoke all on public.ai_interactions from anon, authenticated;
grant select on public.escalations     to authenticated;
grant select on public.ai_interactions to authenticated;
grant all on public.escalations     to service_role;
grant all on public.ai_interactions to service_role;
