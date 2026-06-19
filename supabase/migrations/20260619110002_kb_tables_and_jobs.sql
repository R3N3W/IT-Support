-- Phase 3: kb_articles, kb_chunks, jobs.

create table public.kb_articles (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  title       text not null,
  body        text not null default '',
  status      public.kb_article_status not null default 'draft',
  source      public.kb_source not null default 'manual',
  version     integer not null default 1,
  created_by  uuid references public.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- composite-unique target so kb_chunks can enforce same-tenant linkage.
  constraint kb_articles_id_tenant_key unique (id, tenant_id)
);

comment on table public.kb_articles is 'Per-tenant knowledge base source articles (markdown).';

create index kb_articles_tenant_idx        on public.kb_articles (tenant_id);
create index kb_articles_tenant_status_idx on public.kb_articles (tenant_id, status);

create table public.kb_chunks (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  article_id      uuid not null,
  chunk_index     integer not null,
  content         text not null,
  token_count     integer not null default 0,
  content_hash    text not null,
  embedding       extensions.vector(1024),
  embedding_model text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- chunk belongs to an article in the SAME tenant (DB-enforced).
  constraint kb_chunks_article_fk foreign key (article_id, tenant_id)
    references public.kb_articles (id, tenant_id) on delete cascade,
  constraint kb_chunks_article_index_key unique (article_id, chunk_index)
);

comment on table public.kb_chunks is 'Chunked + embedded KB content for retrieval. Written by trusted ingestion.';

create index kb_chunks_tenant_idx  on public.kb_chunks (tenant_id);
create index kb_chunks_article_idx on public.kb_chunks (article_id, chunk_index);
-- Approximate nearest-neighbour over cosine distance, scoped by tenant in queries.
create index kb_chunks_embedding_idx on public.kb_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

create table public.jobs (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  type         public.job_type not null,
  payload      jsonb not null default '{}'::jsonb,
  status       public.job_status not null default 'pending',
  attempts     integer not null default 0,
  max_attempts integer not null default 3,
  last_error   text,
  run_after    timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.jobs is 'Tenant-scoped background work queue (e.g. KB embedding). Driven by trusted code.';

create index jobs_due_idx    on public.jobs (status, run_after);
create index jobs_tenant_idx on public.jobs (tenant_id);

create trigger kb_articles_set_updated_at
  before update on public.kb_articles
  for each row execute function app.set_updated_at();

create trigger kb_chunks_set_updated_at
  before update on public.kb_chunks
  for each row execute function app.set_updated_at();

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function app.set_updated_at();
