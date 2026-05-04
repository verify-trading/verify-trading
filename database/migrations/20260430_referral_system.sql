-- Referral system: one-time 30% commission on first payment
-- Run this in Supabase SQL Editor

-- 1. Referral links (each user gets one unique code)
create table if not exists public.referral_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz default now()
);

comment on table public.referral_links is 'Stores unique referral codes per user';

-- 2. Referrals (who signed up using whose link)
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id),
  referred_id uuid not null references auth.users(id) unique,
  code text not null,
  status text not null default 'pending' check (status in ('pending', 'converted', 'cancelled')),
  created_at timestamptz default now(),
  converted_at timestamptz
);

comment on table public.referrals is 'Tracks user-to-user referrals';

-- 3. Commissions (one-time, first payment only)
create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id),
  referred_id uuid not null references auth.users(id),
  stripe_invoice_id text not null,
  amount_gbp numeric(10,2) not null,
  commission_gbp numeric(10,2) not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'refunded')),
  created_at timestamptz default now(),
  paid_at timestamptz
);

comment on table public.commissions is 'One-time commission on first referred payment';

-- 4. Payout requests (manual admin approval)
create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id),
  amount_gbp numeric(10,2) not null,
  method text not null check (method in ('paypal', 'wise', 'bank')),
  method_detail text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid')),
  created_at timestamptz default now(),
  paid_at timestamptz
);

comment on table public.payout_requests is 'Manual payout requests from referrers';

-- Indexes for performance
create index if not exists idx_referral_links_user on public.referral_links(user_id);
create index if not exists idx_referral_links_code on public.referral_links(code);
create index if not exists idx_referrals_referrer on public.referrals(referrer_id);
create index if not exists idx_referrals_referred on public.referrals(referred_id);
create index if not exists idx_commissions_referrer on public.commissions(referrer_id);
create index if not exists idx_commissions_status on public.commissions(status);
create index if not exists idx_payout_requests_referrer on public.payout_requests(referrer_id);
create index if not exists idx_payout_requests_status on public.payout_requests(status);

-- RLS Policies

alter table public.referral_links enable row level security;
alter table public.referrals enable row level security;
alter table public.commissions enable row level security;
alter table public.payout_requests enable row level security;

-- referral_links: users can read their own
create policy "Users read own referral link"
  on public.referral_links for select
  using (auth.uid() = user_id);

-- referrals: referrers can see who they referred
create policy "Referrers read own referrals"
  on public.referrals for select
  using (auth.uid() = referrer_id);

-- commissions: users can see their own earnings
create policy "Users read own commissions"
  on public.commissions for select
  using (auth.uid() = referrer_id);

-- payout_requests: users can see their own requests
create policy "Users read own payout requests"
  on public.payout_requests for select
  using (auth.uid() = referrer_id);

create policy "Users create own payout requests"
  on public.payout_requests for insert
  with check (auth.uid() = referrer_id);

-- Admin policies (service_role only, for admin dashboard via server actions)
