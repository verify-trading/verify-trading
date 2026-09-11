-- One hand-tracked account per name, per trader.
--
-- WHY. `resolveDefaultManualAccount` is a read-then-insert with nothing between the two halves.
-- The CSV importer posts days in parallel chunks of five, so a trader's FIRST import had five
-- requests each find no manual account and each create one — five "My journal" rows, with the
-- imported days scattered across them and a challenge scoped to whichever won.
--
-- Partial on kind: connected accounts are named after their broker, and replacing an ICMarkets
-- account with another ICMarkets account would legitimately produce the same name twice.
-- Partial on archived_at so a retired name can be used again.
--
-- The insert catches the violation and re-reads rather than naming this index in an ON CONFLICT:
-- Postgres cannot infer a PARTIAL index unless the statement repeats its WHERE clause, which
-- PostgREST does not emit. Same reason journal_entries_user_account_date_key is not partial.
--
-- Idempotent; safe to re-run.

-- Collapse any duplicates already created, keeping the oldest and moving its entries over.
with ranked as (
  select id, user_id, name,
         row_number() over (partition by user_id, name order by created_at, id) as rn,
         first_value(id) over (partition by user_id, name order by created_at, id) as keep_id
  from public.trading_accounts
  where kind = 'manual' and archived_at is null
)
update public.journal_entries je
set trading_account_id = r.keep_id
from ranked r
where je.trading_account_id = r.id and r.rn > 1;

with ranked as (
  select id, user_id, name,
         row_number() over (partition by user_id, name order by created_at, id) as rn,
         first_value(id) over (partition by user_id, name order by created_at, id) as keep_id
  from public.trading_accounts
  where kind = 'manual' and archived_at is null
)
update public.challenge_config cc
set trading_account_id = r.keep_id
from ranked r
where cc.trading_account_id = r.id and r.rn > 1;

with ranked as (
  select id,
         row_number() over (partition by user_id, name order by created_at, id) as rn
  from public.trading_accounts
  where kind = 'manual' and archived_at is null
)
delete from public.trading_accounts ta
using ranked r
where ta.id = r.id and r.rn > 1;

create unique index if not exists trading_accounts_user_manual_name_key
  on public.trading_accounts (user_id, name)
  where kind = 'manual' and archived_at is null;
