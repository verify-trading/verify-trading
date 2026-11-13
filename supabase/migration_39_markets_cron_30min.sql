-- Migration 39 — markets cron every 30 minutes instead of every 5.
--
-- Apply on the production database (Supabase SQL editor). Idempotent; safe to re-run.
-- Requires migration 29 (call_cron_endpoint, pg_cron).
--
-- Cuts Vercel function time and log volume. The route buckets time into 30-minute runs itself
-- (RUN_INTERVAL_MS in src/app/api/cron/markets/route.ts), so apply this after that deploy;
-- before it, the route still expects 5-minute runs and would only rotate two chart timeframes.
-- cron.schedule with an existing name updates that job.
select cron.schedule('markets-refresh', '*/30 * * * *', $$select public.call_cron_endpoint('/api/cron/markets')$$);

-- Check: select jobname, schedule, active from cron.job where jobname = 'markets-refresh';
