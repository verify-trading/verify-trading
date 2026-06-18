-- TTS prop-firm and guru inputs for verified_entities.
--
-- Both engines follow the same store-inputs / compute-on-read pattern as BTS
-- (src/lib/ask/prop-firms.ts and src/lib/ask/gurus.ts), so a founder override,
-- a refreshed Trustpilot snapshot, or an FCA citation recalculates the displayed
-- result on read with no re-run. Upsert only — never wipe.
--
-- Single table by design: the Ask lookup, verify_entity / list_verified_entities
-- tools, and the RAG entity resolver all target verified_entities, so prop firms
-- and gurus join the same match pass. Type-specific fields are nullable and the
-- descriptive bags are jsonb to keep the table from sprawling.

alter table public.verified_entities
  -- Prop firms (entity_type = 'propfirm') ------------------------------------
  -- year_founded drives the stability pillar; firm_status carries the closure
  -- note ("Closed down…") that hard-overrides the score to Avoid.
  add column if not exists year_founded integer,
  add column if not exists firm_status text,
  -- Trustpilot snapshot the score is based on; shown so the number is transparent.
  add column if not exists trustpilot_rating numeric,
  add column if not exists trustpilot_count integer,
  add column if not exists trustpilot_date date,
  -- Founder's firsthand score. When present it is the displayed score, full stop.
  add column if not exists founder_override_score numeric,
  -- Published terms (funding model, platforms, payout split, etc.) for display.
  add column if not exists prop_terms jsonb,

  -- Gurus (entity_type = 'guru') ---------------------------------------------
  -- Stored tier; never displayed raw — resolveGuruTier() gates it on read.
  add column if not exists guru_tier text,
  add column if not exists founder_tier_override text,
  -- The citation that makes a Caution defensible. Drives the gate below.
  add column if not exists regulator_flag text,
  add column if not exists regulator_flag_source text,
  add column if not exists verified_track_record text,
  add column if not exists research_status text,
  -- Publish gate: nothing public until the founder reviews the row.
  add column if not exists founder_reviewed boolean not null default false,
  -- Identity-ambiguity hold (same-name traps). Default true; the loader sets it
  -- false for flagged rows so they cannot publish until confirmed.
  add column if not exists identity_confirmed boolean not null default true,
  -- Public centrepiece; written to be factual/defensible.
  add column if not exists bio_summary text,
  -- INTERNAL ONLY — suspicions, identity flags, raw observations. Never serialized.
  add column if not exists internal_notes text,
  -- Descriptive facts (handle, platform, audience, region, what they sell).
  add column if not exists guru_profile jsonb;

-- The Caution gate (defense in depth): a guru row may not claim Caution — via the
-- stored tier or the founder override — without a valid http(s) citation URL. The
-- URL shape matches what resolveGuruTier() / the loader require, so all three
-- layers agree on "valid citation"; resolveGuruTier() re-enforces it on read.
alter table public.verified_entities
  drop constraint if exists guru_caution_requires_source;
alter table public.verified_entities
  add constraint guru_caution_requires_source check (
    entity_type <> 'guru'
    or (
      guru_tier is distinct from 'Caution'
      and founder_tier_override is distinct from 'Caution'
    )
    or regulator_flag_source ~* '^https?://'
  );

-- The FCA-handle job and publish queries hit these.
create index if not exists verified_entities_research_status_idx
  on public.verified_entities (research_status)
  where entity_type = 'guru';
