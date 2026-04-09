-- Milestone 1: profiles, usage tracking, saved queries + RLS.
-- Apply after migration_1.sql and migration_2.sql.

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  tier text not null default 'free' check (tier in ('free', 'pro')),
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_tier_idx on public.profiles (tier);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- New signups get a profile row
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(new.email, '@', 1), '')
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Daily Ask usage (UTC calendar day) for free tier
-- ---------------------------------------------------------------------------
create table if not exists public.usage_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  query_count int not null default 0 check (query_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

create index if not exists usage_limits_user_date_idx
  on public.usage_limits (user_id, usage_date desc);

drop trigger if exists set_usage_limits_updated_at on public.usage_limits;
create trigger set_usage_limits_updated_at
before update on public.usage_limits
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Saved queries (bookmarks)
-- ---------------------------------------------------------------------------
create table if not exists public.saved_queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  message_id uuid,
  session_id uuid references public.chat_sessions (id) on delete set null,
  snapshot jsonb,
  created_at timestamptz not null default now()
);

create index if not exists saved_queries_user_created_idx
  on public.saved_queries (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.usage_limits enable row level security;
alter table public.saved_queries enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "usage_limits_select_own" on public.usage_limits;
create policy "usage_limits_select_own"
on public.usage_limits
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "usage_limits_insert_own" on public.usage_limits;
create policy "usage_limits_insert_own"
on public.usage_limits
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "usage_limits_update_own" on public.usage_limits;
create policy "usage_limits_update_own"
on public.usage_limits
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "saved_queries_select_own" on public.saved_queries;
create policy "saved_queries_select_own"
on public.saved_queries
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "saved_queries_insert_own" on public.saved_queries;
create policy "saved_queries_insert_own"
on public.saved_queries
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "saved_queries_update_own" on public.saved_queries;
create policy "saved_queries_update_own"
on public.saved_queries
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "saved_queries_delete_own" on public.saved_queries;
create policy "saved_queries_delete_own"
on public.saved_queries
for delete
to authenticated
using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Atomic daily cap for free tier (called with user JWT from API route)
-- ---------------------------------------------------------------------------
create or replace function public.reserve_ask_query()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_tier text;
  v_day date := (timezone('utc', now()))::date;
  v_current int;
  v_next int;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select tier into v_tier from public.profiles where id = uid;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;

  if v_tier = 'pro' then
    return jsonb_build_object('ok', true, 'tier', 'pro', 'remaining', null);
  end if;

  select query_count into v_current
  from public.usage_limits
  where user_id = uid and usage_date = v_day
  for update;

  if v_current is null then
    insert into public.usage_limits (user_id, usage_date, query_count)
    values (uid, v_day, 1);
    return jsonb_build_object('ok', true, 'tier', 'free', 'remaining', 19);
  end if;

  if v_current >= 20 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'daily_limit',
      'tier', 'free',
      'remaining', 0
    );
  end if;

  v_next := v_current + 1;
  update public.usage_limits
  set query_count = v_next
  where user_id = uid and usage_date = v_day;

  return jsonb_build_object(
    'ok', true,
    'tier', 'free',
    'remaining', 20 - v_next
  );
end;
$$;

grant execute on function public.reserve_ask_query() to authenticated;
revoke execute on function public.reserve_ask_query() from public;

-- Backfill profiles for any auth users created before this migration (e.g. staging imports).
insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(u.email, '@', 1), '')
  )
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
