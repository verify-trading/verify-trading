-- Migration 29 — run the cron passes from Supabase, not Vercel.
--
-- Apply on the production database (Supabase SQL editor). Idempotent; safe to re-run.
--
-- Why: Vercel's Hobby plan caps cron at ONE run per day per job (and two jobs total). The
-- broker cycle runs twice a day as a pair of jobs 35 minutes apart, and the markets refresh
-- wants every five minutes — none of that fits. pg_cron has no such limit, and it is already
-- in the database we depend on.
--
-- The endpoints are unchanged: both sit behind requireCronSecret and expect
-- `Authorization: Bearer <CRON_SECRET>`, exactly what Vercel was sending. Both are GET —
-- hence net.http_get below, NOT http_post, which would 405 on every run.
--
-- BEFORE RUNNING, set these two values for your project (read back below, so the secret is
-- never written into this file or into git):
--
--   select vault.create_secret('https://www.verify.trading', 'app_base_url');
--   select vault.create_secret('<the same value as CRON_SECRET on Vercel>', 'cron_secret');
--
-- To rotate the secret later, update the vault entry — the jobs read it at run time.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- One helper so no job carries its own copy of the base URL, the header shape or the secret
-- lookup. `security definer` because vault.decrypted_secrets is not readable by the cron role.
create or replace function public.call_cron_endpoint(path text)
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  base_url text;
  secret text;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'app_base_url';

  -- Either name works. `.env.example` documents this secret as `markets_cron_secret` (it
  -- predates the broker passes, when markets was the only cron), but there is only ever ONE
  -- value — both endpoints read the same process.env.CRON_SECRET. Accepting both means this
  -- migration doesn't care which name your project already has, and doesn't create a second
  -- copy of the same secret under a new name.
  select decrypted_secret into secret from vault.decrypted_secrets
   where name in ('cron_secret', 'markets_cron_secret')
   order by case name when 'cron_secret' then 0 else 1 end
   limit 1;

  if base_url is null or secret is null then
    raise exception 'call_cron_endpoint: app_base_url missing, or neither cron_secret nor markets_cron_secret is in vault';
  end if;

  -- GET, because that is the only method these routes export. Fire and forget: pg_net queues
  -- the request and returns immediately, so a slow pass can never hold a database worker —
  -- the endpoint owns the work and its own logging.
  perform net.http_get(
    url := base_url || path,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || secret,
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function public.call_cron_endpoint(text) from public, anon, authenticated;

-- Replace rather than duplicate on a re-run. cron.unschedule throws when the job is absent,
-- hence the guard.
do $$
declare
  -- NOT named `job`: inside this block a bare `job` is ambiguous against the cron.job table
  -- itself (Postgres reads it as a possible whole-row reference), and the query errors.
  stale_job text;
begin
  -- Old names included, so a database that already ran an earlier version of this file ends
  -- up with the three jobs below and nothing else. 'refresh-market-cache' is the May 2026
  -- markets job (vault keys markets_cron_base_url/markets_cron_secret) that this file's
  -- 'markets-refresh' replaces — left in place it double-fires the route at :00/:15/:30/:45.
  foreach stale_job in array array['broker-deploy', 'broker-collect', 'broker-close',
                                   'broker-wake', 'broker-pull', 'markets-refresh',
                                   'refresh-market-cache'] loop
    if exists (select 1 from cron.job where jobname = stale_job) then
      perform cron.unschedule(stale_job);
    end if;
  end loop;
end $$;

-- Broker: ONE cycle, run twice a day, in UTC (pg_cron runs on UTC).
--   wake 06:00 / 18:00 — deploys every parked account whose owner is Pro
--   pull 06:35 / 18:35 — imports from whatever connected, then parks everything
--
-- Two IDENTICAL cycles rather than one long window: an account is only deployed while it is
-- being imported from, the two imports are spread twelve hours apart (Asia/London close, then
-- New York close), and the cost is a known ~$5.60/trader/month either way. Nothing here reads
-- a duration — the gap between the pair is the whole knob.
--
-- 35 minutes is headroom, not a measurement: a deploy takes 30 s – 3 min, occasionally longer
-- on the first history download. An account that consistently takes longer misses the cron
-- imports and relies on the trader's own "Sync now"; pull parks it either way.
select cron.schedule('broker-wake', '0 6,18 * * *',  $$select public.call_cron_endpoint('/api/broker/cron?pass=wake')$$);
select cron.schedule('broker-pull', '35 6,18 * * *', $$select public.call_cron_endpoint('/api/broker/cron?pass=pull')$$);

-- Markets: every five minutes, which is the cadence the route is written for — it buckets
-- time into 5-minute runs itself and rotates one chart timeframe per run to stay inside the
-- Twelve Data credit budget. It takes no query params; the clock decides what it does.
-- It was never in vercel.json, so nothing in this repo was scheduling it at all.
select cron.schedule('markets-refresh', '*/5 * * * *', $$select public.call_cron_endpoint('/api/cron/markets')$$);

-- Check them with:
--   select jobname, schedule, active from cron.job order by jobname;
--   select * from cron.job_run_details order by start_time desc limit 20;
