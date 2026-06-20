-- Phase 4: tenant-scoped vector retrieval over the KB.
-- SECURITY DEFINER so it can read kb_chunks under force-RLS, but it ALWAYS
-- restricts to the caller's tenant (app.current_tenant_id, from the verified
-- JWT) and, for non-agents, to PUBLISHED articles only. search_path is pinned
-- empty and the cosine operator is schema-qualified via OPERATOR(extensions.<=>).
create or replace function public.match_kb_chunks(
  query_embedding extensions.vector(1024),
  match_count integer default 5
)
returns table (id uuid, article_id uuid, content text, distance real)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.article_id,
    c.content,
    (c.embedding OPERATOR(extensions.<=>) query_embedding)::real as distance
  from public.kb_chunks c
  join public.kb_articles a
    on a.id = c.article_id and a.tenant_id = c.tenant_id
  where c.tenant_id = app.current_tenant_id()
    and c.embedding is not null
    and (app.is_agent_or_above() or a.status = 'published')
  order by c.embedding OPERATOR(extensions.<=>) query_embedding
  limit greatest(1, least(match_count, 20));
$$;

grant execute on function public.match_kb_chunks(extensions.vector, integer)
  to authenticated, service_role;
