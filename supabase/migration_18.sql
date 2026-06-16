-- Broker Trust Score (BTS) inputs for verified_entities.
--
-- The BTS model stores INPUTS (tier, leverage, founder flags, regulators) and
-- computes the displayed trust score on read (src/lib/ask/bts.ts), so that a
-- live FCA/ASIC result or a band tweak recalculates scores automatically with
-- no re-run. trust_score therefore becomes nullable: it is a cache/override,
-- not the source of truth for BTS rows.
--
-- Precedence when sources disagree: founder-verified (locked) > live API > CSV.
-- Upsert only — never wipe — so live FCA results already on a row survive.
--
-- Only the columns the app reads are added: tier + founder flags + leverage +
-- regulators drive the score; verification_method drives the "Provisional"
-- badge; founder_notes is displayed.

alter table public.verified_entities
  add column if not exists regulators_listed text,
  -- Advertised max retail leverage, normalized to "1:NNN". Drives the FCA
  -- leverage rule: a Tier-1 broker offering > 1:30 retail is onboarding to its
  -- offshore entity and is scored as that entity, not the Tier-1 badge.
  add column if not exists leverage text,
  -- Tier the score band is computed from: Tier 1 / Tier 2 / Tier 3 /
  -- Unregulated / Avoid.
  add column if not exists final_tier text,
  -- Founder verdict overlay: 'Founder reviewed' / 'CAUTION ...' / 'AVOID ...'.
  add column if not exists final_status text,
  -- founder-verified rows are locked: the API does NOT override them.
  add column if not exists founder_verified boolean not null default false,
  -- Founder's expert note, always displayed alongside the score.
  add column if not exists founder_notes text,
  -- What to do with the row: FOUNDER-VERIFIED (locked) / NEEDS FCA-API /
  -- NEEDS register check / Category verdict. Drives the "Provisional" badge.
  add column if not exists verification_method text;

-- BTS rows compute their score on read, so trust_score is no longer required.
alter table public.verified_entities
  alter column trust_score drop not null;
