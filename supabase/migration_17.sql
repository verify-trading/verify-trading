-- Knowledge base for the Ask RAG layer.
--
-- One row per retrievable document: verified entities (brokers / prop firms /
-- gurus), analysis rules, and free-form playbook / policy content. Rows are
-- synced from their source tables by the backfill script
-- (scripts/backfill-knowledge.ts) and re-embedded on admin saves.
--
-- Embeddings default to 1536 dimensions (OpenAI text-embedding-3-small).
-- If you switch embedding models, change vector(1536) below and re-run the
-- backfill before relying on vector search.

create extension if not exists vector;
create extension if not exists pg_trgm;

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('entity', 'rule', 'playbook', 'policy')),
  title text not null,
  content text not null,
  -- Filtering metadata, e.g. {"entity_type":"propfirm","status":"avoid"} or
  -- {"category":"ENTRY","applies_to":"chart","asset_class":"forex"}.
  tags jsonb not null default '{}'::jsonb,
  -- Normalized alternative names used for exact / fuzzy entity resolution.
  aliases text[] not null default '{}',
  -- Title + aliases flattened for trigram matching (misspellings, partials).
  searchable_text text not null default '',
  -- Pointer back to the source row so syncs are idempotent.
  source_table text,
  source_id text,
  embedding vector(1536),
  embedded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_table, source_id)
);

-- Full-text search vector over title + content.
alter table public.knowledge_documents
  add column if not exists content_tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B')
  ) stored;

create index if not exists knowledge_documents_kind_idx
  on public.knowledge_documents (kind);

create index if not exists knowledge_documents_tags_idx
  on public.knowledge_documents using gin (tags);

create index if not exists knowledge_documents_tsv_idx
  on public.knowledge_documents using gin (content_tsv);

create index if not exists knowledge_documents_trgm_idx
  on public.knowledge_documents using gin (searchable_text gin_trgm_ops);

create index if not exists knowledge_documents_aliases_idx
  on public.knowledge_documents using gin (aliases);

-- HNSW works well at this corpus size and needs no training step.
create index if not exists knowledge_documents_embedding_idx
  on public.knowledge_documents using hnsw (embedding vector_cosine_ops);

-- Service-role only (same posture as verified_entities / analysis_rules).
alter table public.knowledge_documents enable row level security;

create or replace function public.set_knowledge_documents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists knowledge_documents_set_updated_at on public.knowledge_documents;
create trigger knowledge_documents_set_updated_at
  before update on public.knowledge_documents
  for each row execute function public.set_knowledge_documents_updated_at();

-- Hybrid retrieval: vector similarity + full-text rank fused with
-- reciprocal rank fusion (RRF). Either signal alone can surface a document.
create or replace function public.match_knowledge(
  query_embedding vector(1536),
  query_text text,
  match_kinds text[] default null,
  match_count int default 8,
  rrf_k int default 50
)
returns table (
  id uuid,
  kind text,
  title text,
  content text,
  tags jsonb,
  score double precision
)
language sql
stable
as $$
  with vector_hits as (
    select kd.id,
           row_number() over (order by kd.embedding <=> query_embedding) as rank
    from public.knowledge_documents kd
    where kd.embedding is not null
      and (match_kinds is null or kd.kind = any (match_kinds))
    order by kd.embedding <=> query_embedding
    limit greatest(match_count * 4, 20)
  ),
  text_hits as (
    select kd.id,
           row_number() over (
             order by ts_rank(kd.content_tsv, websearch_to_tsquery('english', query_text)) desc
           ) as rank
    from public.knowledge_documents kd
    where query_text <> ''
      and kd.content_tsv @@ websearch_to_tsquery('english', query_text)
      and (match_kinds is null or kd.kind = any (match_kinds))
    limit greatest(match_count * 4, 20)
  ),
  fused as (
    select coalesce(v.id, t.id) as id,
           coalesce(1.0 / (rrf_k + v.rank), 0) + coalesce(1.0 / (rrf_k + t.rank), 0) as score
    from vector_hits v
    full outer join text_hits t on t.id = v.id
  )
  select kd.id, kd.kind, kd.title, kd.content, kd.tags, f.score
  from fused f
  join public.knowledge_documents kd on kd.id = f.id
  order by f.score desc
  limit match_count;
$$;

-- Entity resolution: exact alias match first, trigram similarity fallback.
-- Returns the top candidates with a match_type the caller can use to decide
-- between "confident hit", "ask the user to disambiguate", and "no record".
create or replace function public.resolve_entity_candidates(
  query text,
  match_count int default 3,
  min_similarity double precision default 0.3
)
returns table (
  id uuid,
  title text,
  tags jsonb,
  source_id text,
  match_type text,
  similarity double precision
)
language sql
stable
as $$
  with normalized as (
    select lower(regexp_replace(query, '[^a-z0-9 ]', '', 'gi')) as q
  ),
  exact_hits as (
    select kd.id, kd.title, kd.tags, kd.source_id,
           'exact'::text as match_type,
           1.0::double precision as similarity
    from public.knowledge_documents kd, normalized n
    where kd.kind = 'entity'
      and (n.q = any (kd.aliases) or position(' ' || kd.title || ' ' in ' ' || n.q || ' ') > 0)
  ),
  fuzzy_hits as (
    select kd.id, kd.title, kd.tags, kd.source_id,
           'fuzzy'::text as match_type,
           similarity(kd.searchable_text, n.q)::double precision as similarity
    from public.knowledge_documents kd, normalized n
    where kd.kind = 'entity'
      and kd.searchable_text % n.q
      and similarity(kd.searchable_text, n.q) >= min_similarity
      and kd.id not in (select e.id from exact_hits e)
  )
  select * from (
    select * from exact_hits
    union all
    select * from fuzzy_hits
  ) candidates
  order by similarity desc
  limit match_count;
$$;
