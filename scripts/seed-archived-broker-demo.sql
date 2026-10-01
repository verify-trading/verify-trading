-- Demo data for ahmadafaq924@gmail.com: one archived broker, one live broker, overlapping days.
-- Run in the Supabase SQL editor. Remove later with the block at the bottom.
with old_acct as (
  insert into public.trading_accounts (user_id, name, kind, platform, server, broker_name, archived_at)
  values ('143c17c1-9904-45c9-a271-005683701a65', 'Just Global Markets Ltd.', 'connected', 'mt5', 'JustMarkets-Demo3', 'Just Global Markets Ltd.', '2026-09-14T00:16:09Z')
  returning id
), live_acct as (
  insert into public.trading_accounts (user_id, name, kind, platform, server, broker_name)
  values ('143c17c1-9904-45c9-a271-005683701a65', 'XBTFX LLC', 'connected', 'mt5', 'XBTFX-MetaTrader5', 'XBTFX LLC')
  returning id
)
insert into public.journal_entries (user_id, trading_account_id, entry_date, pnl_amount, pnl_currency, mood, note, tags, source)
select '143c17c1-9904-45c9-a271-005683701a65', old_acct.id, d::date, p, 'USD', 'okay', '', array['seed'], 'broker'
from old_acct, (values ('2026-09-01', -1258), ('2026-09-02', 630), ('2026-09-03', 1275), ('2026-09-04', 71), ('2026-09-07', -1388), ('2026-09-10', 505), ('2026-09-11', 102)) as v(d, p)
union all
select '143c17c1-9904-45c9-a271-005683701a65', live_acct.id, d::date, p, 'USD', 'okay', '', array['seed'], 'broker'
from live_acct, (values ('2026-09-03', -1.92), ('2026-09-04', 52.5), ('2026-09-08', 66.5), ('2026-09-09', 66.5), ('2026-09-11', 146), ('2026-09-14', 505)) as v(d, p);

-- Cleanup (run when done):
-- delete from public.journal_entries where user_id = '143c17c1-9904-45c9-a271-005683701a65' and 'seed' = any(tags);
-- delete from public.trading_accounts where user_id = '143c17c1-9904-45c9-a271-005683701a65' and kind = 'connected' and server in ('JustMarkets-Demo3', 'XBTFX-MetaTrader5');
