-- Original BTS research only. Scores and TTS rows are not modified.
-- Confidential staging: service role only; no public policies.
begin;

create table if not exists public.bts_research_brokers_staging (
  entity_id text primary key,
  brand_name text not null,
  website_url text,
  legal_entity text,
  registered_country text,
  operating_status text not null,
  research_status text not null,
  research_date date,
  source_urls text[] not null default '{}',
  research jsonb not null,
  input_sha256 text not null,
  audit jsonb not null default '{}',
  imported_at timestamptz not null default now(),
  regulatory_licences_json jsonb not null default '[]' check (jsonb_typeof(regulatory_licences_json) = 'array')
);
alter table public.bts_research_brokers_staging enable row level security;
revoke all on public.bts_research_brokers_staging from anon, authenticated;
grant select, insert, update, delete on public.bts_research_brokers_staging to service_role;
create index if not exists bts_research_brokers_staging_website on public.bts_research_brokers_staging (lower(website_url));

create table if not exists public.bts_research_prop_firms_staging (
  entity_id text primary key,
  brand_name text not null,
  website_url text,
  legal_entity text,
  registered_country text,
  operating_status text not null,
  research_status text not null,
  research_date date,
  source_urls text[] not null default '{}',
  research jsonb not null,
  input_sha256 text not null,
  audit jsonb not null default '{}',
  imported_at timestamptz not null default now()
);
alter table public.bts_research_prop_firms_staging enable row level security;
revoke all on public.bts_research_prop_firms_staging from anon, authenticated;
grant select, insert, update, delete on public.bts_research_prop_firms_staging to service_role;
create index if not exists bts_research_prop_firms_staging_website on public.bts_research_prop_firms_staging (lower(website_url));

create table if not exists public.bts_research_tools_staging (
  entity_id text primary key,
  brand_name text not null,
  website_url text,
  legal_entity text,
  registered_country text,
  operating_status text not null,
  research_status text not null,
  research_date date,
  source_urls text[] not null default '{}',
  research jsonb not null,
  input_sha256 text not null,
  audit jsonb not null default '{}',
  imported_at timestamptz not null default now()
);
alter table public.bts_research_tools_staging enable row level security;
revoke all on public.bts_research_tools_staging from anon, authenticated;
grant select, insert, update, delete on public.bts_research_tools_staging to service_role;
create index if not exists bts_research_tools_staging_website on public.bts_research_tools_staging (lower(website_url));

commit;
