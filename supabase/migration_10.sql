-- ============================================================
-- migration_10.sql — email_subscribers table
-- Collects emails from the landing page "Get free guide" CTA.
-- ============================================================

create table if not exists public.email_subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  source      text not null default 'landing_guide',
  subscribed  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint  email_subscribers_email_source_unique unique (email, source)
);

comment on table public.email_subscribers is 'Pre-launch and guide email collection from the landing page.';

-- Index for quick lookups and dedup checks.
create index if not exists idx_email_subscribers_email on public.email_subscribers (email);

-- RLS: Only service-role can insert — the API route uses the admin client.
alter table public.email_subscribers enable row level security;

-- No public-facing select/insert policies intentionally.
-- The admin/service-role client bypasses RLS.
