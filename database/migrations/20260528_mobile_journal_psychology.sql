create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  mood text not null check (mood in ('good', 'okay', 'tough')),
  pnl_amount numeric(12, 2),
  pnl_currency text not null default 'GBP',
  note text not null default '',
  lesson text,
  challenge_status_note text,
  tags text[] not null default '{}',
  source text not null default 'mobile',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.journal_entries
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists entry_date date,
  add column if not exists mood text,
  add column if not exists pnl_amount numeric(12, 2),
  add column if not exists pnl_currency text not null default 'GBP',
  add column if not exists note text not null default '',
  add column if not exists lesson text,
  add column if not exists challenge_status_note text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists source text not null default 'mobile',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'journal_entries_mood_check'
  ) then
    alter table public.journal_entries
      add constraint journal_entries_mood_check
      check (mood in ('good', 'okay', 'tough'));
  end if;
end $$;

create index if not exists journal_entries_user_date_idx
  on public.journal_entries (user_id, entry_date desc, created_at desc, id desc);

create unique index if not exists journal_entries_user_entry_date_key
  on public.journal_entries (user_id, entry_date);

create table if not exists public.challenge_config (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  firm_name text not null,
  firm_url text not null,
  account_size numeric(14, 2) not null,
  account_type text not null,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists challenge_config_user_key
  on public.challenge_config (user_id);

create table if not exists public.overheat_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trigger_type text not null,
  trigger_value numeric(14, 2) not null,
  user_response text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.journal_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  insight_text text not null,
  generated_at timestamptz not null default now()
);

create index if not exists journal_insights_user_generated_idx
  on public.journal_insights (user_id, generated_at desc, id desc);

create index if not exists overheat_logs_user_created_idx
  on public.overheat_logs (user_id, created_at desc, id desc);

drop trigger if exists set_journal_entries_updated_at on public.journal_entries;
create trigger set_journal_entries_updated_at
before update on public.journal_entries
for each row
execute function public.set_updated_at();

create table if not exists public.psychology_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  section_scores jsonb not null,
  total_score integer not null check (total_score >= 0 and total_score <= 75),
  max_score integer not null default 75,
  zone_label text not null,
  focus_area text not null,
  summary text not null,
  answers jsonb,
  q1_trading_situation text,
  q2_stress_level text,
  q3_financial_situation text,
  q4_sleep_quality text,
  q5_energy_level text,
  q29_focus text not null default '',
  flag_chasing boolean not null default false,
  flag_compulsive boolean not null default false,
  flag_financial_pressure boolean not null default false,
  flag_sleep_poor boolean not null default false,
  flag_rebuilding boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.psychology_assessments
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists section_scores jsonb,
  add column if not exists total_score integer,
  add column if not exists max_score integer not null default 75,
  add column if not exists zone_label text,
  add column if not exists focus_area text,
  add column if not exists summary text,
  add column if not exists answers jsonb,
  add column if not exists q1_trading_situation text,
  add column if not exists q2_stress_level text,
  add column if not exists q3_financial_situation text,
  add column if not exists q4_sleep_quality text,
  add column if not exists q5_energy_level text,
  add column if not exists q29_focus text not null default '',
  add column if not exists flag_chasing boolean not null default false,
  add column if not exists flag_compulsive boolean not null default false,
  add column if not exists flag_financial_pressure boolean not null default false,
  add column if not exists flag_sleep_poor boolean not null default false,
  add column if not exists flag_rebuilding boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'psychology_assessments'
      and column_name = 'archetype'
  ) then
    update public.psychology_assessments
    set zone_label = coalesce(zone_label, archetype, 'Developing Trader')
    where zone_label is null;
  else
    update public.psychology_assessments
    set zone_label = coalesce(zone_label, 'Developing Trader')
    where zone_label is null;
  end if;
end $$;

create table if not exists public.psychology_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_id uuid references public.psychology_assessments(id) on delete set null,
  created_at timestamptz not null default now(),
  duration_secs integer not null default 0,
  message_count integer not null default 1,
  break_recommended boolean not null default false
);

create index if not exists psychology_sessions_user_created_idx
  on public.psychology_sessions (user_id, created_at desc, id desc);

create index if not exists psychology_assessments_user_created_idx
  on public.psychology_assessments (user_id, created_at desc, id desc);

drop trigger if exists set_psychology_assessments_updated_at on public.psychology_assessments;
create trigger set_psychology_assessments_updated_at
before update on public.psychology_assessments
for each row
execute function public.set_updated_at();

alter table public.journal_entries enable row level security;
alter table public.challenge_config enable row level security;
alter table public.overheat_logs enable row level security;
alter table public.journal_insights enable row level security;
alter table public.psychology_assessments enable row level security;
alter table public.psychology_sessions enable row level security;

drop policy if exists "journal_entries_select_own" on public.journal_entries;
create policy "journal_entries_select_own"
on public.journal_entries
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "journal_entries_insert_own" on public.journal_entries;
create policy "journal_entries_insert_own"
on public.journal_entries
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "journal_entries_update_own" on public.journal_entries;
create policy "journal_entries_update_own"
on public.journal_entries
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "journal_entries_delete_own" on public.journal_entries;
create policy "journal_entries_delete_own"
on public.journal_entries
for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "challenge_config_all_own" on public.challenge_config;
create policy "challenge_config_all_own"
on public.challenge_config
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "overheat_logs_all_own" on public.overheat_logs;
create policy "overheat_logs_all_own"
on public.overheat_logs
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "journal_insights_select_own" on public.journal_insights;
create policy "journal_insights_select_own"
on public.journal_insights
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "psychology_assessments_select_own" on public.psychology_assessments;
create policy "psychology_assessments_select_own"
on public.psychology_assessments
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "psychology_assessments_insert_own" on public.psychology_assessments;
create policy "psychology_assessments_insert_own"
on public.psychology_assessments
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "psychology_assessments_delete_own" on public.psychology_assessments;
create policy "psychology_assessments_delete_own"
on public.psychology_assessments
for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "psychology_sessions_select_own" on public.psychology_sessions;
create policy "psychology_sessions_select_own"
on public.psychology_sessions
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "psychology_sessions_insert_own" on public.psychology_sessions;
create policy "psychology_sessions_insert_own"
on public.psychology_sessions
for insert
to authenticated
with check (user_id = (select auth.uid()));
