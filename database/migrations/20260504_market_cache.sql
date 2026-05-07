-- Single-table market cache for Twelve Data persistence
-- All market data (quotes, sparklines, events) stored as JSONB blobs

create table if not exists public.market_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  payload jsonb not null,
  fetched_at timestamptz default now()
);

comment on table public.market_cache is 'Single-table cache for Twelve Data market snapshots. Each row holds a complete dataset keyed by cache_key.';

-- Fast lookup by cache key
create unique index if not exists idx_market_cache_key on public.market_cache(cache_key);

-- RLS: public read (anyone can read market data), service_role write
alter table if exists public.market_cache disable row level security;

-- Empty placeholders for dynamic data (cron will populate)
insert into public.market_cache (cache_key, payload, fetched_at)
values 
  ('quotes:all', '{"quotes":{}}'::jsonb, now()),
  ('sparklines:all', '{"sparklines":{}}'::jsonb, now()),
  ('events:dividends', '{"items":[]}'::jsonb, now())
on conflict (cache_key) do nothing;
