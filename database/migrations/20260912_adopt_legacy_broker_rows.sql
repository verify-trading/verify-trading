-- Repair: the cutover made the importer duplicate days it had already imported.
--
-- WHAT HAPPENED. 20260910 deliberately left pre-existing rows unassigned, and 20260911 moved the
-- importer's conflict target to (user_id, trading_account_id, entry_date). Postgres treats NULLs
-- as DISTINCT, so an unassigned row never matched that target: instead of rewriting the day it
-- already owned, the next sync inserted a second row for it. One day (2026-09-09) was duplicated
-- before this was caught, and every legacy broker day still inside a sync window would follow.
--
-- Aggregates sum every row, so a duplicated day is counted twice in total P&L, win count and
-- win rate.
--
-- THE FIX. Give those legacy broker rows the account they actually came from, so the importer
-- rewrites them instead of racing them. Safe only where attribution is not a guess:
--   * source = 'broker' only — a hand-logged row must never be auto-attributed to a broker
--   * the trader has exactly ONE live connected account
--   * and has never replaced one (no archived accounts), since a replaced account's history is
--     indistinguishable from the current account's on the row itself
-- Anyone outside that stays unassigned, which is the honest state and still behaves as today.
--
-- Idempotent; safe to re-run. Pause broker-wake / broker-pull if running near 06:35 or 18:35 UTC.

-- Traders whose legacy broker rows can be attributed without guessing. Inlined as a CTE in both
-- statements rather than a temp table: the SQL editor runs each statement in its own transaction,
-- so an `on commit drop` table is gone before the second one reads it.
--
-- 1. Remove the duplicates the importer already created. Provably duplicates: same trader, same
--    day, both written by the importer, one unassigned and one on the account being adopted into.
--    The assigned row is kept because that is the one the importer maintains from now on.
with adoptable as (
  select ta.user_id, ta.id as trading_account_id
  from public.trading_accounts ta
  where ta.kind = 'connected'
    and ta.archived_at is null
    and not exists (
      select 1 from public.trading_accounts other
      where other.user_id = ta.user_id and other.id <> ta.id and other.kind = 'connected'
    )
    and not exists (
      select 1 from public.trading_accounts arch
      where arch.user_id = ta.user_id and arch.archived_at is not null
    )
)
delete from public.journal_entries legacy
using adoptable a, public.journal_entries assigned
where legacy.user_id = a.user_id
  and legacy.trading_account_id is null
  and legacy.source = 'broker'
  and assigned.user_id = legacy.user_id
  and assigned.entry_date = legacy.entry_date
  and assigned.trading_account_id = a.trading_account_id
  and assigned.source = 'broker';

-- 2. Adopt what is left, so the conflict target matches and the next sync updates in place.
with adoptable as (
  select ta.user_id, ta.id as trading_account_id
  from public.trading_accounts ta
  where ta.kind = 'connected'
    and ta.archived_at is null
    and not exists (
      select 1 from public.trading_accounts other
      where other.user_id = ta.user_id and other.id <> ta.id and other.kind = 'connected'
    )
    and not exists (
      select 1 from public.trading_accounts arch
      where arch.user_id = ta.user_id and arch.archived_at is not null
    )
)
update public.journal_entries je
set trading_account_id = a.trading_account_id
from adoptable a
where je.user_id = a.user_id
  and je.trading_account_id is null
  and je.source = 'broker';
