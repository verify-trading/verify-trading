-- Cutover: retire the one-row-per-trader-per-day rule.
--
-- RUN THIS AFTER the web deploy that carries the account-aware writers. That is the only
-- prerequisite: no client controls the SQL, so no app version blocks this.
--
--   1. 20260910_trading_accounts.sql applied
--   2. web deployed (broker sync, the entries route, and delete all address accounts)
--   3. then this
--
-- MOBILE DOES NOT GATE THIS. Older builds post no account and delete by date; the server
-- resolves an account for the first and resolves a single row for the second, so they keep
-- working unchanged. Only the SERVER names a conflict target, and after step 2 it never names
-- the old one.
--
-- The window that matters is between this migration and step 2, not after it: `ON CONFLICT
-- (user_id, entry_date)` raises 42P10 once the index is gone (verified, not assumed), so the
-- PREVIOUS web build's saves would fail. Hence deploy first, then drop.
--
-- Pause broker-wake / broker-pull across the swap (migration_29_broker_cron.sql).
-- Idempotent; safe to re-run.

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'journal_entries_user_account_date_key'
  ) then
    raise exception 'Run 20260910_trading_accounts.sql first: the replacement index is missing.';
  end if;
end $$;

drop index if exists public.journal_entries_user_entry_date_key;
