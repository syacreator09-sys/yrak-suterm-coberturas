-- YRAK RAG sidecar schema for Supabase/Postgres.
-- Generate the executable SQL with scripts/render-supabase-rag-schema.mjs.
-- D1 remains canonical for labor/coverage/rotation/competition/assignment state.

create extension if not exists vector with schema extensions;

create table if not exists public.yrak_rag_documents (
  id text primary key,
  organization_id text not null,
  group_id text null,
  version text not null,
  sha256 text not null,
  mime_type text null,
  source text null,
  classification text null,
  effective_from date null,
  effective_to date null,
  r2_key text null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','SUPERSEDED','ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sha256, version)
);

create table if not exists public.yrak_rag_chunks (
  id text primary key,
  document_id text not null references public.yrak_rag_documents(id) on delete restrict,
  chunk_index integer not null check (chunk_index >= 0),
  chunk_text text not null,
  embedding extensions.vector(__RAG_EMBEDDING_DIMENSIONS__) not null,
  page integer null check (page is null or page >= 1),
  section text null,
  token_count integer null check (token_count is null or token_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists idx_yrak_rag_documents_scope
  on public.yrak_rag_documents(organization_id, group_id, status);

create index if not exists idx_yrak_rag_chunks_document
  on public.yrak_rag_chunks(document_id, chunk_index);

create index if not exists idx_yrak_rag_chunks_embedding_hnsw
  on public.yrak_rag_chunks using hnsw (embedding extensions.vector_cosine_ops);

alter table public.yrak_rag_documents enable row level security;
alter table public.yrak_rag_chunks enable row level security;

revoke all on public.yrak_rag_documents from public, anon, authenticated;
revoke all on public.yrak_rag_chunks from public, anon, authenticated;
grant select, insert, update on public.yrak_rag_documents to service_role;
grant select, insert, update on public.yrak_rag_chunks to service_role;

create or replace function public.yrak_match_chunks(
  query_embedding extensions.vector(__RAG_EMBEDDING_DIMENSIONS__),
  p_organization_id text,
  p_allowed_group_ids text[] default null,
  p_organization_wide boolean default false,
  p_active_only boolean default true,
  p_match_count integer default 32
)
returns table (
  chunk_id text,
  document_id text,
  organization_id text,
  group_id text,
  chunk_text text,
  similarity double precision,
  status text,
  page integer,
  section text,
  document_version text,
  source text
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    c.id as chunk_id,
    d.id as document_id,
    d.organization_id,
    d.group_id,
    c.chunk_text,
    (1 - (c.embedding <=> query_embedding))::double precision as similarity,
    d.status,
    c.page,
    c.section,
    d.version as document_version,
    d.source
  from public.yrak_rag_chunks c
  join public.yrak_rag_documents d on d.id = c.document_id
  where d.organization_id = p_organization_id
    and (
      p_organization_wide
      or (
        d.group_id is not null
        and d.group_id = any(coalesce(p_allowed_group_ids, array[]::text[]))
      )
    )
    and (
      not p_active_only
      or (
        d.status = 'ACTIVE'
        and (d.effective_from is null or d.effective_from <= current_date)
        and (d.effective_to is null or d.effective_to >= current_date)
      )
    )
  order by c.embedding <=> query_embedding
  limit least(greatest(p_match_count, 1), 80);
$$;

revoke all on function public.yrak_match_chunks(extensions.vector, text, text[], boolean, boolean, integer) from public, anon, authenticated;
grant execute on function public.yrak_match_chunks(extensions.vector, text, text[], boolean, boolean, integer) to service_role;
