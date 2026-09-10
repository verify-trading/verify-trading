-- Trading accounts: give every set of journal entries an owning account.
--
-- WHY. `journal_entries` is unique on (user_id, entry_date) — ONE row per trader per day, with
-- no account column. Two write paths fight over that row with opposite policies: the manual save
-- upserts unconditionally and overwrites a broker-imported day, while the importer sets
-- ignoreDuplicates and skips a hand-logged one. So a personal trade and a challenge trade on the
-- same date cannot both exist, and challenge figures count every entry regardless of origin.
-- Scoping challenge_config alone would not have fixed this: it would have filtered on a
-- separation the rows never had, making the numbers look scoped while they were still colliding.
--
-- Apply on the production database. Idempotent; safe to re-run.
-- CUTOVER: pause the broker cron (broker-wake / broker-pull) before running. The old upserts
-- target the old constraint and must not race the swap. See migration_29_broker_cron.sql.

create table if not exists public.trading_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Shown to the trader when they pick an account. 'FTMO challenge', 'Personal'.
  name text not null,
  kind text not null check (kind in ('connected', 'manual')),
  -- Display identity, and what the challenge-setup warning compares against. Lives HERE, not on
  -- broker_accounts, because identity has to outlive the connection: disconnecting must not lose
  -- which account the history belonged to. Null for kind='manual'. NEVER credentials.
  platform text check (platform in ('mt4', 'mt5')),
  server text,
  broker_name text,
  -- Archive, never delete: entries and challenges point here and must keep resolving.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lets the child tables carry a COMPOSITE foreign key on (account, user), which is what actually
-- stops one trader's entry pointing at another trader's account. A plain FK on id alone cannot.
create unique index if not exists trading_accounts_id_user_key
  on public.trading_accounts (id, user_id);

create index if not exists trading_accounts_user_idx
  on public.trading_accounts (user_id) where archived_at is null;

-- The live MetaApi link points at the durable identity. user_id stays unique on broker_accounts
-- (one CONNECTED account per trader, v1) — trading_accounts is where multiples become possible.
alter table public.broker_accounts
  add column if not exists trading_account_id uuid references public.trading_accounts(id);

alter table public.journal_entries
  add column if not exists trading_account_id uuid;
alter table public.challenge_config
  add column if not exists trading_account_id uuid;

-- Composite FKs: the referenced account must belong to the SAME user as the row pointing at it.
-- on delete restrict, because archiving is the only retirement — a deleted identity would orphan
-- history. (A user delete still cascades from auth.users through both tables.)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'journal_entries_trading_account_fk') then
    alter table public.journal_entries
      add constraint journal_entries_trading_account_fk
      foreign key (trading_account_id, user_id)
      references public.trading_accounts (id, user_id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'challenge_config_trading_account_fk') then
    alter table public.challenge_config
      add constraint challenge_config_trading_account_fk
      foreign key (trading_account_id, user_id)
      references public.trading_accounts (id, user_id) on delete restrict;
  end if;
end $$;

-- Account-aware uniqueness: one row per (trader, account, day). Created here but NOT yet load
-- bearing — the original (user_id, entry_date) index still stands, so nothing can collide yet.
-- Dropping it is a separate migration that runs only after every writer stamps an account.
--
-- Two indexes, not one: Postgres treats NULLs as distinct in a unique index, so the first does
-- not constrain legacy rows at all. The second keeps the original one-per-day rule for entries
-- that were never assigned an account, which is every row that exists today.
-- Deliberately NOT partial. Nulls already compare distinct, so this constrains exactly the
-- assigned rows either way — but a non-partial index can be named by
-- `ON CONFLICT (user_id, trading_account_id, entry_date)`, and a partial one cannot unless the
-- statement repeats its WHERE clause, which PostgREST will not emit. Keeping it inferrable is
-- what lets the writers stay simple upserts instead of read-then-write races.
create unique index if not exists journal_entries_user_account_date_key
  on public.journal_entries (user_id, trading_account_id, entry_date);

create unique index if not exists journal_entries_user_date_unassigned_key
  on public.journal_entries (user_id, entry_date)
  where trading_account_id is null;

-- Mint an identity for each LIVE connection. Ownership is establishable here: user_id is unique
-- on broker_accounts, so the row is that trader's one connected account.
--
-- journal_entries are deliberately NOT backfilled. A trader who replaced an account has broker
-- rows from an account that no longer exists, and nothing on the row says which. Guessing would
-- silently attribute one account's history to another; unassigned is the honest state, and the
-- partial index above keeps those rows behaving exactly as they do today.
insert into public.trading_accounts (user_id, name, kind, platform)
select ba.user_id, 'Connected account', 'connected', ba.platform
from public.broker_accounts ba
where ba.disconnected_at is null
  and ba.trading_account_id is null
  and not exists (
    select 1 from public.trading_accounts ta
    where ta.user_id = ba.user_id and ta.kind = 'connected' and ta.archived_at is null
  );

update public.broker_accounts ba
set trading_account_id = ta.id
from public.trading_accounts ta
where ta.user_id = ba.user_id
  and ta.kind = 'connected'
  and ta.archived_at is null
  and ba.trading_account_id is null
  and ba.disconnected_at is null;

alter table public.trading_accounts enable row level security;

-- Read-only to the owner, matching broker_accounts: the service role does every write, so a
-- client cannot mint an account for itself or rename one out from under a challenge.
drop policy if exists "trading_accounts_select_own" on public.trading_accounts;
create policy "trading_accounts_select_own"
on public.trading_accounts
for select
to authenticated
using (user_id = (select auth.uid()));

-- Manual accounts only, and with no broker identity attached. A trader creating their own
-- "FTMO challenge" account is ordinary; a client inserting kind='connected' with
-- broker_name='FTMO Global Markets Ltd' would make the challenge-setup note assert something
-- MetaApi never confirmed. Connected rows are minted server-side by the connect route.
drop policy if exists "trading_accounts_insert_own_manual" on public.trading_accounts;
create policy "trading_accounts_insert_own_manual"
on public.trading_accounts
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and kind = 'manual'
  and server is null
  and broker_name is null
  and platform is null
);
