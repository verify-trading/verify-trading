-- Supabase Cron scheduler for the Markets cache refresh.
-- Replaces Vercel Cron so Hobby deployments are not blocked by sub-daily schedules.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

select cron.unschedule(jobid)
from cron.job
where jobname = 'refresh-market-cache';

select cron.schedule(
  'refresh-market-cache',
  '*/5 * * * *',
  $$
  with secrets as (
    select
      max(decrypted_secret) filter (where name = 'markets_cron_base_url') as base_url,
      max(decrypted_secret) filter (where name = 'markets_cron_secret') as cron_secret
    from vault.decrypted_secrets
    where name in ('markets_cron_base_url', 'markets_cron_secret')
  )
  select
    case
      when base_url is not null and cron_secret is not null then
        net.http_get(
          url := rtrim(base_url, '/') || '/api/cron/markets',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || cron_secret
          )
        )
      else null
    end
  from secrets;
  $$
);
