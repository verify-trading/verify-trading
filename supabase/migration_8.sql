-- Stripe billing foundation: customer mapping, subscription state, and webhook idempotency.

alter table public.profiles
  add column if not exists stripe_customer_id text;

create unique index if not exists profiles_stripe_customer_id_key
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create table if not exists public.billing_subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  stripe_price_id text,
  stripe_product_id text,
  status text not null check (
    status in (
      'incomplete',
      'incomplete_expired',
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'paused'
    )
  ),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancel_at timestamptz,
  canceled_at timestamptz,
  ended_at timestamptz,
  currency text,
  unit_amount integer,
  interval text,
  interval_count integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing_subscriptions
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists stripe_product_id text,
  add column if not exists status text,
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists cancel_at timestamptz,
  add column if not exists canceled_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists currency text,
  add column if not exists unit_amount integer,
  add column if not exists interval text,
  add column if not exists interval_count integer,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'billing_subscriptions_status_check'
  ) then
    alter table public.billing_subscriptions
      add constraint billing_subscriptions_status_check
      check (
        status in (
          'incomplete',
          'incomplete_expired',
          'trialing',
          'active',
          'past_due',
          'canceled',
          'unpaid',
          'paused'
        )
      );
  end if;
end $$;

create unique index if not exists billing_subscriptions_customer_key
  on public.billing_subscriptions (stripe_customer_id);

create index if not exists billing_subscriptions_status_idx
  on public.billing_subscriptions (status);

drop trigger if exists set_billing_subscriptions_updated_at on public.billing_subscriptions;
create trigger set_billing_subscriptions_updated_at
before update on public.billing_subscriptions
for each row
execute function public.set_updated_at();

create table if not exists public.stripe_webhook_events (
  id text primary key,
  type text not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.stripe_webhook_events
  add column if not exists type text,
  add column if not exists processed_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

alter table public.billing_subscriptions enable row level security;
alter table public.stripe_webhook_events enable row level security;

drop policy if exists "billing_subscriptions_select_own" on public.billing_subscriptions;
create policy "billing_subscriptions_select_own"
on public.billing_subscriptions
for select
to authenticated
using (user_id = (select auth.uid()));
