-- BTS Layer 2: independent live re-assessments (web research + rubric scored by code).
-- Additive: bts_scores (Layer 1) is never overwritten; both numbers stay for audit.
-- One table on purpose: evidence, sources and timings live in `assessment`; the newest
-- unexpired row per (subject, user_country) is the cache.

create table if not exists public.bts_l2_assessments (
  id bigint generated always as identity primary key,
  -- bts_scores.entity_id when the engine knows the firm, else "name:<lowercase name>"
  subject text not null,
  entity_id text references public.bts_scores (entity_id) on delete set null,
  kind text not null check (kind in ('broker', 'propfirm')),
  firm text not null,
  user_country text not null,
  baseline_score integer,
  baseline_verdict text,
  final_score integer check (final_score between 0 and 100),
  final_verdict text not null,
  confidence integer check (confidence between 0 and 100),
  country_fit text,
  rubric_version text not null,
  model text not null,
  latency_ms integer,
  checked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  -- validated fields only: pillars, findings, sources, strengths, risks, summary, identity
  assessment jsonb not null,
  -- raw model output, private, for troubleshooting
  raw jsonb
);

create index if not exists bts_l2_assessments_lookup
  on public.bts_l2_assessments (subject, user_country, checked_at desc);

alter table public.bts_l2_assessments enable row level security;
