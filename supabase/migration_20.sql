-- Align the RAG entity resolver with the read-path matcher (src/lib/ask/entities.ts).
--
-- resolve_entity_candidates feeds the model's RETRIEVED CONTEXT block with
-- "closest entities" hints. It previously ranked the fuzzy leg with
-- word_similarity() + a low 0.3 floor, which is NOT word-boundary aware: a query
-- like "zentova markets" scored MC/IC/KQ Markets ~0.8 purely on the shared common
-- word "markets", surfacing noise the model then had to ignore.
--
-- strict_word_similarity() only credits whole-word-aligned extents, so a match
-- carried by one common token scores far lower and falls under the floor. This
-- mirrors how verify_entity (the verdict path) already abstains on such inputs,
-- so the two resolvers now agree instead of drifting. The exact leg is unchanged.
--
-- min_similarity is a parameter; 0.5 is the strict-word default. Tune against real
-- queries after applying: lower it if real firms stop surfacing, raise it if noise
-- returns. The existing gin_trgm_ops indexes already support the strict operators.

create or replace function public.resolve_entity_candidates(
  query text,
  match_count int default 3,
  min_similarity double precision default 0.5
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
    -- Whole alias, or the whole title appearing as words in the query.
    select kd.id, kd.title, kd.tags, kd.source_id,
           'exact'::text as match_type,
           1.0::double precision as similarity
    from public.knowledge_documents kd, normalized n
    where kd.kind = 'entity'
      and (n.q = any (kd.aliases) or position(' ' || lower(kd.title) || ' ' in ' ' || n.q || ' ') > 0)
  ),
  fuzzy_hits as (
    -- strict_word_similarity: boundary-aware, so a single shared common word
    -- ("markets") cannot carry a match the way word_similarity allowed.
    select kd.id, kd.title, kd.tags, kd.source_id,
           'fuzzy'::text as match_type,
           greatest(
             strict_word_similarity(kd.title, n.q),
             strict_word_similarity(kd.searchable_text, n.q)
           )::double precision as similarity
    from public.knowledge_documents kd, normalized n
    where kd.kind = 'entity'
      and greatest(
        strict_word_similarity(kd.title, n.q),
        strict_word_similarity(kd.searchable_text, n.q)
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

revoke execute on function public.resolve_entity_candidates(text, int, double precision) from anon, authenticated;
