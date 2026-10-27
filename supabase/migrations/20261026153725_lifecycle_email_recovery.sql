-- Apply after migration_35_lifecycle_email.sql, before deploying the recovery code.
-- Re-runnable. Existing rows remain sent: without a saved payload we cannot safely replay them.
begin;

alter table public.email_sends
  add column if not exists status text not null default 'sent'
    check (status in ('pending', 'sending', 'sent', 'blocked')),
  add column if not exists payload jsonb,
  add column if not exists first_attempt_at timestamptz,
  add column if not exists processing_started_at timestamptz;
grant select, insert, update on public.email_sends to service_role;

-- The row lock only covers the claim, never the network call. Payload and first-attempt time
-- survive retries so Resend receives exactly the same request and idempotency key.
create or replace function public.claim_lifecycle_email(
  p_user_id uuid, p_email_id text, p_dedupe_key text, p_kind text,
  p_variant text, p_payload jsonb
)
returns table (
  id uuid, payload jsonb, status text,
  first_attempt_at timestamptz, processing_started_at timestamptz
)
language plpgsql
-- Needs auth.users for the send-time confirmation check; executable only by service_role.
security definer
set search_path = ''
as $$
declare
  v_row public.email_sends%rowtype;
  v_now timestamptz := now();
begin
  -- Serialize claims for a recipient so a changed pick cannot bypass an unresolved send.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  insert into public.email_sends (user_id, email_id, dedupe_key, kind, variant, payload, status)
  values (p_user_id, p_email_id, p_dedupe_key, p_kind, p_variant, p_payload, 'pending')
  on conflict (user_id, dedupe_key) do nothing;

  select * into v_row from public.email_sends e
  where e.user_id = p_user_id and e.dedupe_key = p_dedupe_key
  for update;

  if v_row.status = 'sending' and v_row.processing_started_at > v_now - interval '5 minutes' then
    return;
  end if;

  if v_row.status not in ('sent', 'blocked') then
    -- Resend retains idempotency keys for 24h. Stop before that expires rather than risking
    -- a second delivery after an ambiguous timeout. Blocked rows need dashboard reconciliation.
    if v_row.first_attempt_at <= v_now - interval '23 hours' then
      update public.email_sends e set status = 'blocked'
      where e.id = v_row.id returning * into v_row;
    else
      if p_kind = 'marketing' then
        -- Recheck recipient eligibility at the send boundary, after the cron's snapshot.
        if not exists (
          select 1 from auth.users u join public.profiles p on p.id = u.id
          where u.id = p_user_id and u.email_confirmed_at is not null
            and u.email = v_row.payload->>'to' and p.email_opt_out_at is null
            and (p.signup_welcome_email_sent_at is null
              or p.signup_welcome_email_sent_at <= v_now - interval '24 hours')
            and (p.tier <> 'pro' or p_email_id not in ('e2a', 'e3a', 'e2b', 'e3b', 'c1', 'c2', 'c3', 'c6'))
        ) or exists (
          select 1 from public.email_sends e
          where e.user_id = p_user_id and e.id <> v_row.id
            and ((e.status in ('sent', 'blocked') and e.sent_at > v_now - interval '24 hours')
              or e.first_attempt_at > v_now - interval '24 hours' and e.status in ('pending', 'sending'))
        ) then
          return;
        end if;
      end if;
      update public.email_sends e
      set status = 'sending', processing_started_at = v_now,
          first_attempt_at = coalesce(e.first_attempt_at, v_now)
      where e.id = v_row.id returning * into v_row;
    end if;
  end if;

  return query select v_row.id, v_row.payload, v_row.status,
    v_row.first_attempt_at, v_row.processing_started_at;
end;
$$;
revoke all on function public.claim_lifecycle_email(uuid, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.claim_lifecycle_email(uuid, text, text, text, text, jsonb)
  to service_role;

-- The subscription row is the durable retry source, even when the webhook fails before
-- it can render/claim an email. Completed email_sends rows are included so a failed stamp heals.
create index if not exists billing_subscriptions_pending_welcome_idx
  on public.billing_subscriptions (created_at)
  where welcome_email_sent_at is null and status in ('active', 'trialing', 'past_due');

create or replace function public.lifecycle_pending_subscription_welcomes(p_since timestamptz, p_limit int)
returns table (user_id uuid, stripe_subscription_id text)
language sql
stable
security invoker
set search_path = ''
as $$
  select b.user_id, b.stripe_subscription_id
  from public.billing_subscriptions b
  left join public.email_sends e
    on e.user_id = b.user_id and e.dedupe_key = 'c5:' || b.stripe_subscription_id
  where b.welcome_email_sent_at is null
    and b.status in ('active', 'trialing', 'past_due')
    and b.created_at >= p_since
    and (e.status is null or e.status <> 'blocked')
  order by b.created_at, b.stripe_subscription_id
  limit greatest(0, least(p_limit, 100));
$$;
revoke all on function public.lifecycle_pending_subscription_welcomes(timestamptz, int)
  from public, anon, authenticated;
grant execute on function public.lifecycle_pending_subscription_welcomes(timestamptz, int)
  to service_role;

-- Only confirmed addresses enter marketing. The unchanged E1 sender's existing profile
-- marker counts toward the 24h gap; incomplete sends stay eligible for the regular picker.
create or replace function public.lifecycle_user_facts(p_since timestamptz)
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
    from (
      select s.email_id, s.dedupe_key, s.kind, s.sent_at
      from public.email_sends s
      where s.user_id = p.id and s.status in ('sent', 'blocked')
      union all
      select 'e1', 'e1', 'transactional', p.signup_welcome_email_sent_at
      where p.signup_welcome_email_sent_at is not null
    ) e
  ) snd on true
  where p.created_at >= p_since
    and u.email is not null
    and u.email_confirmed_at is not null;
$$;

revoke all on function public.lifecycle_user_facts(timestamptz) from public, anon, authenticated;
grant execute on function public.lifecycle_user_facts(timestamptz) to service_role;


commit;
