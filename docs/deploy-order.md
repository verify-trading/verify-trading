# Deploy order: the markets cron

## What schedules `/api/cron/markets` today

Supabase `pg_cron`, not Vercel Cron. Job `refresh-market-cache` uses `pg_net` to
`GET {vault:markets_cron_base_url}/api/cron/markets` with
`Authorization: Bearer {vault:markets_cron_secret}`
(`database/migrations/20260508_supabase_markets_cron.sql`).

Vercel Cron has been gone since 2026-05-08 (`621f79f`, "Move markets cron scheduling to
Supabase"); it previously ran `*/5 * * * *`. The deployed `vercel.json` (`client/main`)
only pins `"regions": ["dub1"]`, so **the working tree having no crons changes nothing** —
production already has none.

**The live job runs `*/15 * * * *`, not the `*/5` in the migration file.** Evidence:
production `market_cache.fetched_at` lands on :00/:15/:30/:45 and the timeframe rotation
steps `3M → 1M → 1W → 1D` (a +3 jump in the route's 5-minute run counter, i.e. −1 mod 4).
The job was re-scheduled in the DB; the repo text has drifted. Check with
`select jobname, schedule, active from cron.job;`.

## The actual deploy risk: `CRON_SECRET`

The working tree moves the route onto shared `requireCronSecret`
(`src/lib/http/cron-auth.ts`), which **fails closed in production** when `CRON_SECRET` is
unset; the deployed inline check fails *open*. If production is currently running
unauthenticated, every run 401s the moment this deploys and markets data goes stale
silently — `pg_net` ignores the response.

1. **Before deploying:** confirm `CRON_SECRET` is set in Vercel → Production and equals
   Vault `markets_cron_secret` (`select name from vault.decrypted_secrets;`).
2. Deploy.
3. **After:** `market_cache` key `cron:markets:last-run` should show `ok: true` and
   `quotes:24/24` within 15 minutes.

`supabase/migration_29_broker_cron.sql` is a separate, not-yet-applied pg_cron migration
owned by the broker work with the same Vault + `CRON_SECRET` dependency — same window.

## Is `*/15` safe?

Yes. The route's budget comment sizes a run at 25 credits (24 quotes + 1 market state) plus
24 for one rotated timeframe = 49, under Twelve Data's 55/min cap. Cadence changes only
freshness, not per-run cost: quotes every 15 min instead of 5, each chart timeframe hourly
instead of every 20 min. The duplicate-run guard buckets 5-minute windows, so at `*/15` it
never trips — it only defends against double-fires. Restoring `*/5` needs no code change.
