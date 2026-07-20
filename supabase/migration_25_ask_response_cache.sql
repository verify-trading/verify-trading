-- Migration 25: shared response cache for single-entity Ask lookups.
--
-- Repeated bare lookups of the same firm ("alpha futures", "is alphafutures
-- legit") re-ran the full model pipeline for an answer already computed. This
-- table stores the finished card payload keyed on the resolved entity plus a
-- fingerprint of its register row, so:
--   * every paraphrase of the same firm hits one entry (the entity resolver
--     is the normalizer), and
--   * any edit to the entity's register row changes the fingerprint and makes
--     stale entries unreachable immediately — no TTL race after a score or
--     warning change.
--
-- Only the service role touches this table; RLS stays enabled with no
-- policies so anon/authenticated keys can neither read nor poison the cache.

CREATE TABLE IF NOT EXISTS ask_response_cache (
  cache_key text PRIMARY KEY,
  entity_slug text NOT NULL,
  payload jsonb NOT NULL,
  model text NOT NULL,
  hit_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS ask_response_cache_entity_slug_idx
  ON ask_response_cache (entity_slug);

ALTER TABLE ask_response_cache ENABLE ROW LEVEL SECURITY;

-- Hit counting happens on the serverless hot path; a single UPDATE keeps it
-- atomic under concurrent hits (read-modify-write over REST would race).
CREATE OR REPLACE FUNCTION increment_ask_response_cache_hit(p_cache_key text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE ask_response_cache
  SET hit_count = hit_count + 1
  WHERE cache_key = p_cache_key;
$$;

REVOKE ALL ON FUNCTION increment_ask_response_cache_hit(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION increment_ask_response_cache_hit(text) FROM anon;
REVOKE ALL ON FUNCTION increment_ask_response_cache_hit(text) FROM authenticated;
