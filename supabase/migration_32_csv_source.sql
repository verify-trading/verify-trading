-- Migration 32 — 'csv' is a source, not a tag
--
-- Apply on the production database (Supabase SQL editor). Idempotent; safe to
-- re-run.
--
-- Problem: a CSV statement import posts through POST /api/journal/entries like
-- any other save, so the server stamped it `source = 'mobile'` and the only mark
-- separating an imported day from one the trader actually journaled was a bare
-- 'csv' tag in the tags array. Tags are client-supplied and client-editable, and
-- every reader that must exclude imported days (coach context, weekly insight,
-- the mood strip) therefore had to select the tags column and check it — a query
-- that forgot reads every CSV day as the trader's own account of that day.
--
-- Fix: the route now stamps `source = 'csv'` when the payload carries the 'csv'
-- tag. The check constraint has to admit that value first, and the rows written
-- before it did have to be corrected, or the same day reads differently
-- depending on when it was imported.
--
-- The mobile contract is unchanged: it still sends the 'csv' tag (and its
-- `csv:<ts>` attribution tag), and GET /api/journal/entries still returns source.

-- Widen the check. Dropped and recreated rather than added conditionally:
-- migration 27 created this constraint with the three-value list, so an
-- `if not exists` guard would leave the old one in place on every live database.
alter table public.journal_entries
  drop constraint if exists journal_entries_source_check;

alter table public.journal_entries
  add constraint journal_entries_source_check
  check (source in ('manual', 'mobile', 'broker', 'csv'));

-- Backfill the rows the route wrote before it stamped them. The bare 'csv' tag is
-- exactly the predicate isImportedRow used for those rows, so this rewrites the
-- same set it was already reading as imported — and nothing else. Days the trader
-- has since edited had the bare tag stripped by the app, which is what made them
-- theirs; those correctly stay 'mobile'.
--
-- Re-running is a no-op: after the first pass no 'mobile' row carries the tag.
update public.journal_entries
  set source = 'csv'
  where source = 'mobile'
    and tags @> array['csv']::text[];

-- Once this has run, the `tags?.includes('csv')` fallback in isImportedRow
-- (src/lib/journal/contracts.ts) is dead and can go, along with every reader's
-- obligation to select the tags column just to answer "was this imported?".
