-- Knowledge base for the Ask RAG layer (text-search only, no embeddings).
--
-- One row per retrievable document: verified entities (brokers / prop firms /
-- gurus), analysis rules, and free-form playbook / policy content. Rows are
-- synced from their source tables by the backfill script
-- (scripts/data/backfill-knowledge.mjs).
--
-- Retrieval is hybrid full-text + trigram. If semantic search is needed later,
-- add an embedding vector column + HNSW index in a follow-up migration and
-- extend match_knowledge with a vector leg; the table layout does not change.

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

create index if not exists knowledge_documents_title_trgm_idx
  on public.knowledge_documents using gin (title gin_trgm_ops);

create index if not exists knowledge_documents_aliases_idx
  on public.knowledge_documents using gin (aliases);

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

-- Hybrid retrieval: full-text rank + trigram title similarity, fused with
-- reciprocal rank fusion (RRF). Either signal alone can surface a document.
create or replace function public.match_knowledge(
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
  with text_hits as (
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
  trgm_hits as (
    -- word_similarity (not similarity): a short title/alias must match the best
    -- substring of a long conversational query, e.g. "Pepperstone" inside
    -- "is pepperstone safe to deposit with as a uk trader".
    select kd.id,
           row_number() over (
             order by greatest(
               word_similarity(kd.title, query_text),
               word_similarity(kd.searchable_text, query_text)
             ) desc
           ) as rank
    from public.knowledge_documents kd
    where query_text <> ''
      and greatest(
        word_similarity(kd.title, query_text),
        word_similarity(kd.searchable_text, query_text)
      ) >= 0.3
      and (match_kinds is null or kd.kind = any (match_kinds))
    limit greatest(match_count * 4, 20)
  ),
  fused as (
    select coalesce(t.id, g.id) as id,
           coalesce(1.0 / (rrf_k + t.rank), 0) + coalesce(1.0 / (rrf_k + g.rank), 0) as score
    from text_hits t
    full outer join trgm_hits g on g.id = t.id
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
    -- lower(kd.title): n.q is already lowercased, titles are not, so the
    -- "whole title appears in the query" check must compare like cases.
    select kd.id, kd.title, kd.tags, kd.source_id,
           'exact'::text as match_type,
           1.0::double precision as similarity
    from public.knowledge_documents kd, normalized n
    where kd.kind = 'entity'
      and (n.q = any (kd.aliases) or position(' ' || lower(kd.title) || ' ' in ' ' || n.q || ' ') > 0)
  ),
  fuzzy_hits as (
    -- word_similarity so a firm name embedded in a longer question still
    -- resolves (similarity() drops sharply as the query gets longer).
    select kd.id, kd.title, kd.tags, kd.source_id,
           'fuzzy'::text as match_type,
           greatest(
             word_similarity(kd.title, n.q),
             word_similarity(kd.searchable_text, n.q)
           )::double precision as similarity
    from public.knowledge_documents kd, normalized n
    where kd.kind = 'entity'
      and greatest(
        word_similarity(kd.title, n.q),
        word_similarity(kd.searchable_text, n.q)
      ) >= min_similarity
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

-- Retrieval runs only from the server (service role). Keep these off the
-- public PostgREST surface; the table's RLS already returns nothing to anon.
revoke execute on function public.match_knowledge(text, text[], int, int) from anon, authenticated;
revoke execute on function public.resolve_entity_candidates(text, int, double precision) from anon, authenticated;
