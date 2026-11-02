-- Migration 36 — BTS scoring engine v2 (bts-score-2.0)
--
-- Apply on the production database (Supabase SQL editor). Idempotent; safe to re-run.
-- Then load: node --env-file=.env.local scripts/data/load-bts-scores.mjs <dir with the engine CSVs>
--
-- Structure (2 new tables, 1 new column):
--   verified_entities   site identity (slug, name, aliases, guru fields). Its old score columns
--                       (trust_score, final_tier, final_status, firm_status, founder_override_score…)
--                       are no longer read; drop them in a later migration once v2 is signed off.
--   bts_scores          one row per firm the engine scored: brokers, prop firms and tools.
--   bts_country_fit     one row per broker per country (66 + XX).
--
-- The engine (run offline) produces every score and verdict; the site only reads these tables.
-- No commercial data goes in here. RLS is on with no policies: only the service role reads them.

create table if not exists public.bts_scores (
  entity_id text primary key,                       -- engine id, e.g. BTS-B-0117
  kind text not null check (kind in ('broker', 'propfirm', 'tool')),
  brand_name text not null,
  operating_status text,
  research_status text,
  global_score int,                                 -- null for UNDER REVIEW / NOT ACTIVE
  raw_score_before_cap int,
  evidence_confidence int,
  verdict text not null check (verdict in ('VERIFIED', 'CAUTION', 'HIGH RISK', 'INSUFFICIENT DATA', 'UNDER REVIEW', 'NOT ACTIVE')),
  verdict_reason text,
  cap_applied text,
  pillars jsonb not null default '{}',              -- {"regulation": "35", "conduct": "not checked", …} in engine order
  details jsonb not null default '{}',              -- kind-specific engine columns (licences, account_model, tool_category…)
  score_version text,
  research_date date
);

-- Primary key (country, entity_id) doubles as the (country, entity_id) index lists need.
create table if not exists public.bts_country_fit (
  country text not null,                            -- ISO alpha-2, or XX = unknown
  entity_id text not null references public.bts_scores (entity_id) on delete cascade,
  country_fit text,
  country_score int,
  country_verdict text not null,
  applicable_licences text,
  country_note text,
  primary key (country, entity_id)
);
create index if not exists bts_country_fit_entity_idx on public.bts_country_fit (entity_id);

alter table public.bts_scores enable row level security;
alter table public.bts_country_fit enable row level security;

-- Site record -> engine row. Several site rows may share one (e.g. "ig" and "iggroup").
alter table public.verified_entities add column if not exists bts_entity_id text references public.bts_scores (entity_id) on delete set null;
