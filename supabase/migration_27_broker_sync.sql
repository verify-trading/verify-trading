-- Migration 27 — MetaTrader broker sync (MetaApi)
--
-- Apply on the production database (Supabase SQL editor). Idempotent; safe to
-- re-run.
--
-- A Pro trader connects ONE MT4/MT5 account. We create the account at MetaApi
-- WITHOUT credentials and hand back a configuration link — the trader types their
-- login + investor password on MetaApi's own hosted page, so no broker credential
-- ever reaches this database. The only handle we keep is MetaApi's account id.
--
-- No `state` column on purpose: connection state lives at MetaApi and is derived
-- live on every GET /api/broker/account. A stored copy would go stale the moment a
-- deploy finishes or a broker drops the session, and stale state is exactly the bug
-- class this feature would otherwise ship with.
--
-- `region` is null until the first sync: MetaStats is region-routed (a call to the
-- wrong region 404s indistinguishably from "no such account"), so every sync reads
-- the region off the live account snapshot and rewrites this column.
--
-- `last_deploy_at` is a lock, not a log. Deployments are billed individually and
-- MetaApi has no idempotency for them, while the mobile client polls "Sync now"
-- every four seconds during provisioning — so the engine claims the right to deploy
-- with a conditional UPDATE on this column and only calls MetaApi if the claim won.
-- It is deliberately NOT last_synced_at: that one drives the import window and the
-- count the client reports back to the trader.
--
-- Writes come exclusively from the service role (the sync engine and the three cron
-- passes), same trust model as profiles.tier: the owner may read their row, nothing
-- else client-side may touch it.

create table if not exists public.broker_accounts (
  id uuid primary key default gen_random_uuid(),
  -- unique: one connected account per trader in v1. Drop the constraint when
  -- multi-account ships; nothing else in the design assumes it.
  user_id uuid not null unique references auth.users(id) on delete cascade,
  metaapi_account_id text not null,
  platform text not null check (platform in ('mt4','mt5')),
  region text,
  last_synced_at timestamptz,
  last_sync_error text,
  last_deploy_at timestamptz,
  created_at timestamptz not null default now()
);

-- Separate add as well as the column above, so a database that already ran an earlier
-- version of this file (which had no deploy lock) picks it up on a re-run.
alter table public.broker_accounts
  add column if not exists last_deploy_at timestamptz;

alter table public.broker_accounts enable row level security;

drop policy if exists "broker_accounts_select_own" on public.broker_accounts;
create policy "broker_accounts_select_own"
on public.broker_accounts
for select
to authenticated
using (user_id = (select auth.uid()));

-- No insert/update/delete policies: only the service role writes this table.

-- Imported days land in the existing journal_entries table (one row per user per
-- day), so the calendar, aggregates and streaks in GET /api/journal/entries pick
-- them up with no changes to that route.
--
-- Both columns below may already exist:
--   * trade_details was added by database/migrations/20260724_journal_trade_details.sql
--     (drafted, may never have been applied) — `if not exists` makes either case fine.
--     The importer never writes it: that column holds the manual form's shape, and the
--     raw MetaStats rows are re-pullable whenever a per-trade feature needs them.
--   * source has existed since 20260528_mobile_journal_psychology.sql as
--     `text not null default 'mobile'`, and POST /api/journal/entries writes 'mobile'
--     on every manual save. The add below is therefore a no-op on a live database and
--     is kept only so a fresh one ends up with the column.
alter table public.journal_entries
  add column if not exists trade_details jsonb,
  add column if not exists source text not null default 'manual';

-- The check has to admit 'mobile' as well as ('manual','broker'): every existing row
-- carries it, and adding a constraint that excludes live data would fail the migration
-- and break the manual-save path. The importer only ever reads this as
-- "is it 'broker' or not" — and reads it as a `where source = 'broker'` predicate on its
-- own UPDATE, so a day the trader typed is never overwritten and there is no read-then-
-- write gap for a manual save to be lost in.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'journal_entries_source_check'
  ) then
    alter table public.journal_entries
      add constraint journal_entries_source_check
      check (source in ('manual', 'mobile', 'broker'));
  end if;
end $$;

-- No new index: the importer's insert conflicts on (user_id, entry_date) and its
-- follow-up update filters on the same pair, both of which the existing unique index
-- on those columns already serves.
