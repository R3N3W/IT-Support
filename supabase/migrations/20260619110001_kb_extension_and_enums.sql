-- Phase 3: knowledge base + ingestion. Enable pgvector and define enums.
create extension if not exists vector with schema extensions;

create type public.kb_article_status as enum ('draft', 'published', 'archived');
create type public.kb_source        as enum ('manual', 'upload', 'url');
create type public.job_type         as enum ('embed_article');
create type public.job_status       as enum ('pending', 'running', 'succeeded', 'failed');
