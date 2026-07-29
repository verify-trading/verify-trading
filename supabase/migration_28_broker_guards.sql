-- Migration 28 — two columns the broker flow was missing. No new tables.
--
-- Apply on the production database (Supabase SQL editor). Idempotent; safe to re-run.
-- Depends on migration_27_broker_sync.sql.

-- 1. journal_entries.deleted_at — deleted days stay deleted.
--
-- The importer decides insert-vs-update purely on whether a row exists for
-- (user_id, entry_date): `ignoreDuplicates` leaves any existing row alone. A HARD delete
-- therefore erased the only evidence the day was ever imported, and the next sync covering
-- that date put it straight back — while the confirm dialog promised "this can't be undone".
-- One transient MetaApi error widens the window to the full 90 days, so a single blip
-- resurrected every day deleted in that span at once.
--
-- Soft-deleting fixes it without a tombstone table: the row survives, so the importer's
-- existing `ignoreDuplicates` skips the date for free. Every read filters `deleted_at is
-- null`; a manual save clears it, so re-logging a day you deleted works and hands the date
-- back to the importer.
alter table public.journal_entries
  add column if not exists deleted_at timestamptz;

-- Partial index: every read is "the live rows for this user", and the deleted ones are a
-- small minority we never scan for.
create index if not exists journal_entries_live_idx
  on public.journal_entries (user_id, entry_date desc)
  where deleted_at is null;

-- 2. broker_accounts.disconnected_at — disconnecting parks the account, it doesn't burn it.
--
-- Deleting the account at MetaApi threw away the $2.10 one-off join fee, so every
-- reconnect paid it again — and nothing throttled a disconnect/reconnect loop. Parking
-- instead keeps the account (and its id) so reconnecting costs nothing, and a parked
-- account bills ~$0.001/hr rather than the ~$0.013/hr a deployed one does.
--
-- The row is now the trader's ONE account for the life of their profile: the unique index
-- on user_id makes the insert an atomic claim, and reconnect flips this column back to
-- null instead of creating anything. Nothing else needs to know about the state — the cron
-- passes and the read path just skip rows where this is set.
alter table public.broker_accounts
  add column if not exists disconnected_at timestamptz;
