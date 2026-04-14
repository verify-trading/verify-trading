-- Harden Stripe billing concurrency: support multiple subscriptions per user,
-- atomically claim webhook deliveries, and dedupe checkout session creation.

alter table public.billing_subscriptions
  drop constraint if exists billing_subscriptions_pkey;

drop index if exists public.billing_subscriptions_customer_key;

create unique index if not exists billing_subscriptions_subscription_key
  on public.billing_subscriptions (stripe_subscription_id);

create index if not exists billing_subscriptions_user_id_idx
  on public.billing_subscriptions (user_id);

create index if not exists billing_subscriptions_customer_id_idx
  on public.billing_subscriptions (stripe_customer_id);

create table if not exists public.billing_checkout_sessions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null check (plan in ('monthly', 'annual')),
  checkout_token text not null,
  stripe_checkout_session_id text,
  checkout_url text,
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing_checkout_sessions
  add column if not exists plan text,
  add column if not exists checkout_token text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists checkout_url text,
  add column if not exists expires_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'billing_checkout_sessions_plan_check'
  ) then
    alter table public.billing_checkout_sessions
      add constraint billing_checkout_sessions_plan_check
      check (plan in ('monthly', 'annual'));
  end if;
end $$;

create unique index if not exists billing_checkout_sessions_token_key
  on public.billing_checkout_sessions (checkout_token);

drop trigger if exists set_billing_checkout_sessions_updated_at on public.billing_checkout_sessions;
create trigger set_billing_checkout_sessions_updated_at
before update on public.billing_checkout_sessions
for each row
execute function public.set_updated_at();

alter table public.billing_checkout_sessions enable row level security;

drop policy if exists "billing_checkout_sessions_select_own" on public.billing_checkout_sessions;
create policy "billing_checkout_sessions_select_own"
on public.billing_checkout_sessions
for select
to authenticated
using (user_id = (select auth.uid()));

alter table public.stripe_webhook_events
  add column if not exists processing_started_at timestamptz;

create or replace function public.claim_stripe_webhook_event(
  p_id text,
  p_type text,
  p_lock_seconds integer default 300
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.stripe_webhook_events (id, type, processing_started_at)
  values (p_id, p_type, now())
  on conflict do nothing;

  if found then
    return true;
  end if;

  update public.stripe_webhook_events
     set type = p_type,
         processing_started_at = now()
   where id = p_id
     and processed_at is null
     and (
       processing_started_at is null
       or processing_started_at < now() - make_interval(secs => greatest(p_lock_seconds, 30))
     );

  return found;
end;
$$;

revoke execute on function public.claim_stripe_webhook_event(text, text, integer) from public;

create or replace function public.release_stripe_webhook_event_claim(p_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.stripe_webhook_events
     set processing_started_at = null
   where id = p_id
     and processed_at is null;
$$;

revoke execute on function public.release_stripe_webhook_event_claim(text) from public;

create or replace function public.claim_billing_checkout_session(
  p_user_id uuid,
  p_plan text,
  p_checkout_token text,
  p_hold_seconds integer default 1800
)
returns table (
  checkout_token text,
  stripe_checkout_session_id text,
  checkout_url text,
  expires_at timestamptz,
  reused boolean,
  replaced_checkout_session_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.billing_checkout_sessions%rowtype;
  v_expires_at timestamptz := now() + make_interval(secs => greatest(p_hold_seconds, 60));
begin
  select *
    into v_row
    from public.billing_checkout_sessions
   where user_id = p_user_id
   for update;

  if found then
    if v_row.completed_at is null
       and v_row.expires_at > now()
       and v_row.plan = p_plan then
      return query
      select
        v_row.checkout_token,
        v_row.stripe_checkout_session_id,
        v_row.checkout_url,
        v_row.expires_at,
        true,
        null::text;
      return;
    end if;

    update public.billing_checkout_sessions
       set plan = p_plan,
           checkout_token = p_checkout_token,
           stripe_checkout_session_id = null,
           checkout_url = null,
           expires_at = v_expires_at,
           completed_at = null
     where user_id = p_user_id;

    return query
    select
      p_checkout_token,
      null::text,
      null::text,
      v_expires_at,
      false,
      case
        when v_row.completed_at is null and v_row.expires_at > now() then v_row.stripe_checkout_session_id
        else null::text
      end;
    return;
  end if;

  begin
    insert into public.billing_checkout_sessions (
      user_id,
      plan,
      checkout_token,
      expires_at
    ) values (
      p_user_id,
      p_plan,
      p_checkout_token,
      v_expires_at
    );
  exception
    when unique_violation then
      return query
      select *
        from public.claim_billing_checkout_session(
          p_user_id,
          p_plan,
          p_checkout_token,
          p_hold_seconds
        );
      return;
  end;

  return query
  select
    p_checkout_token,
    null::text,
    null::text,
    v_expires_at,
    false,
    null::text;
end;
$$;

revoke execute on function public.claim_billing_checkout_session(uuid, text, text, integer) from public;
