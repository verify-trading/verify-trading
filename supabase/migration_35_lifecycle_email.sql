-- Migration 35 — lifecycle emails (docs/lifecycle-emails-spec.md)
--
-- Apply on the production database (Supabase SQL editor). Idempotent; safe to re-run.
--
-- Base lifecycle schema; follow with the recovery migration in supabase/migrations/.
-- The database gathers facts per user; every
-- rule (timings, caps, priorities, copy) lives in src/lib/email/lifecycle/config.ts, so tuning
-- the flows never needs another migration.
--
-- PREREQUISITES: none new. The cron job reuses public.call_cron_endpoint and the Vault secrets
-- app_base_url + cron_secret from migration_29. Until /api/cron/lifecycle-email is deployed the
-- job gets a 404 every 15 minutes, which is harmless. Once deployed, marketing is live unless
-- LIFECYCLE_EMAIL_TEST_TO contains an allowlist. Apply the recovery migration before deploying
-- the recovery code (see docs/lifecycle-emails-spec.md §6).

-- ---------------------------------------------------------------------------
-- 1. Send log: idempotency (unique claim), frequency caps, history for reporting.
--    dedupe_key = email_id for one-time emails ('e2a'), or email_id:date for repeatable
--    ones ('c3:2026-10-15'), so a claim is a plain insert ... on conflict do nothing.
-- ---------------------------------------------------------------------------
create table if not exists public.email_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email_id text not null,
  dedupe_key text not null,
  kind text not null check (kind in ('transactional', 'marketing')),
  variant text,
  resend_id text,
  sent_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index if not exists email_sends_user_sent_idx on public.email_sends (user_id, sent_at desc);
create index if not exists email_sends_sent_idx on public.email_sends (sent_at);

-- Server-only: RLS on with no policies, and no grants to the API roles.
alter table public.email_sends enable row level security;
revoke all on public.email_sends from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Marketing opt-out (null = subscribed). Set by the unsubscribe link.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists email_opt_out_at timestamptz;

-- ---------------------------------------------------------------------------
-- 3. One row of facts per user who signed up on/after p_since.
--    Activity comes from usage_limits (users cannot delete it; web + app both write it),
--    not chat_messages (users can delete chats). chat_messages only supplies the first
--    question's text for the topic branch.
--    A function, not a view: a view in public would be exposed through the API and leak
--    email addresses. Only the service role may execute it.
-- ---------------------------------------------------------------------------
drop function if exists public.lifecycle_user_facts(timestamptz);
create function public.lifecycle_user_facts(p_since timestamptz)
returns table (
  user_id uuid,
  email text,
  display_name text,
  tier text,
  signup_at timestamptz,
  email_opt_out_at timestamptz,
  first_active_at timestamptz,
  last_active_at timestamptz,
  active_days int,
  third_active_at timestamptz,
  capped_today boolean,
  first_question text,
  pro_since timestamptz,
  checkout_started_at timestamptz,
  checkout_plan text,
  sends jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    u.email::text,
    p.display_name,
    p.tier,
    p.created_at,
    p.email_opt_out_at,
    act.first_active_at,
    act.last_active_at,
    coalesce(act.active_days, 0)::int,
    act.third_active_at,
    coalesce(today.query_count, 0) >= 5,
    fq.content,
    pro.pro_since,
    co.updated_at,
    co.plan,
    coalesce(snd.sends, '[]'::jsonb)
  from public.profiles p
  join auth.users u on u.id = p.id
  left join lateral (
    select
      min(ul.created_at) as first_active_at,
      max(ul.updated_at) as last_active_at,
      count(*) as active_days,
      (array_agg(ul.created_at order by ul.usage_date))[3] as third_active_at
    from public.usage_limits ul
    where ul.user_id = p.id and ul.query_count > 0
  ) act on true
  left join public.usage_limits today
    on today.user_id = p.id and today.usage_date = (timezone('utc', now()))::date
  left join lateral (
    select left(cm.content, 500) as content
    from public.chat_sessions cs
    join public.chat_messages cm on cm.session_id = cs.id
    where cs.user_id = p.id and cm.role = 'user'
    order by cm.created_at
    limit 1
  ) fq on true
  left join lateral (
    select min(b.created_at) as pro_since
    from public.billing_subscriptions b
    where b.user_id = p.id and b.status in ('active', 'trialing', 'past_due')
  ) pro on true
  left join public.billing_checkout_sessions co
    on co.user_id = p.id and co.completed_at is null
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'email_id', e.email_id,
        'dedupe_key', e.dedupe_key,
        'kind', e.kind,
        'sent_at', e.sent_at
      ) order by e.sent_at
    ) as sends
    from public.email_sends e
    where e.user_id = p.id
  ) snd on true
  where p.created_at >= p_since
    and u.email is not null;
$$;

revoke all on function public.lifecycle_user_facts(timestamptz) from public, anon, authenticated;
grant execute on function public.lifecycle_user_facts(timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Every 15 minutes. cron.schedule with an existing name updates that job (re-run safe).
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron with schema extensions;
select cron.schedule(
  'lifecycle-email',
  '*/15 * * * *',
  $$select public.call_cron_endpoint('/api/cron/lifecycle-email')$$
);

-- Check with:
--   select jobname, schedule, active from cron.job where jobname = 'lifecycle-email';
--   select count(*) from public.lifecycle_user_facts(now() - interval '30 days');
