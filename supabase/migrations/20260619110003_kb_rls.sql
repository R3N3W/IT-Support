-- Phase 3: RLS for KB + jobs.

-- ---- kb_articles ------------------------------------------------------------
alter table public.kb_articles enable row level security;
alter table public.kb_articles force row level security;

-- Agents+ see all articles in their tenant; end-users see only published ones.
create policy kb_articles_select on public.kb_articles
  for select to authenticated
  using (
    tenant_id = app.current_tenant_id()
    and (app.is_agent_or_above() or status = 'published')
  );

-- Only agents+ may create/edit articles, within their own tenant.
create policy kb_articles_insert on public.kb_articles
  for insert to authenticated
  with check (
    tenant_id = app.current_tenant_id() and app.is_agent_or_above()
  );

create policy kb_articles_update on public.kb_articles
  for update to authenticated
  using (tenant_id = app.current_tenant_id() and app.is_agent_or_above())
  with check (tenant_id = app.current_tenant_id() and app.is_agent_or_above());

-- No delete policy: articles are archived (status), not deleted, by app roles.

-- ---- kb_chunks --------------------------------------------------------------
alter table public.kb_chunks enable row level security;
alter table public.kb_chunks force row level security;

-- Agents+ may read chunks in their tenant. End-user retrieval is a controlled
-- server-side path added in Phase 4 (over published articles only); chunks are
-- written exclusively by trusted ingestion (service role).
create policy kb_chunks_select on public.kb_chunks
  for select to authenticated
  using (
    tenant_id = app.current_tenant_id() and app.is_agent_or_above()
  );

-- ---- jobs -------------------------------------------------------------------
alter table public.jobs enable row level security;
alter table public.jobs force row level security;

-- Agents+ may view their tenant's jobs (e.g. ingestion status). Jobs are
-- created and processed only by trusted code (service role).
create policy jobs_select on public.jobs
  for select to authenticated
  using (
    tenant_id = app.current_tenant_id() and app.is_agent_or_above()
  );

-- ---- grants (least privilege; rows still constrained by RLS) -----------------
revoke all on public.kb_articles from anon, authenticated;
revoke all on public.kb_chunks   from anon, authenticated;
revoke all on public.jobs        from anon, authenticated;

grant select, insert, update on public.kb_articles to authenticated;
grant select                 on public.kb_chunks   to authenticated;
grant select                 on public.jobs        to authenticated;

grant all on public.kb_articles to service_role;
grant all on public.kb_chunks   to service_role;
grant all on public.jobs        to service_role;
