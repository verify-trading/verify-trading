-- Migration 34 — `fresh` broker pass: import a new link within minutes, app open or not.
--
-- Apply on the production database (Supabase SQL editor). Idempotent; safe to re-run.
-- Requires migration 29 (call_cron_endpoint, pg_cron, pg_net, vault secrets).
--
-- Before this, the FIRST import of a new or replaced connection ran from the app, and only while
-- the trader stayed on the broker screen until the account connected. One who left waited for
-- the 06:00 / 18:00 UTC wake pass — up to twelve hours of "I connected and nothing happened".
--
-- The `where exists` is what keeps this cheap: the endpoint is only called while some live link
-- has never synced, so for a database where everyone is synced the job is a local no-op.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'broker-fresh') then
    perform cron.unschedule('broker-fresh');
  end if;
end $$;

select cron.schedule(
  'broker-fresh',
  '*/5 * * * *',
  $$select public.call_cron_endpoint('/api/broker/cron?pass=fresh')
     where exists (select 1 from public.broker_accounts
                   where disconnected_at is null and last_synced_at is null and last_sync_error is null)$$
);

-- Check with:
--   select jobname, schedule, active from cron.job order by jobname;
