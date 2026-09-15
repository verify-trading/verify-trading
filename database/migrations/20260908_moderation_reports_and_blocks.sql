-- Minimal moderation primitives for community and generated content.
-- Additive only: old mobile clients continue to work unchanged.

create table if not exists public.user_blocks (
  blocker_user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  check (blocker_user_id <> blocked_user_id)
);

create index if not exists user_blocks_blocked_idx
  on public.user_blocks (blocked_user_id, blocker_user_id);

create table if not exists public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('community_message', 'community_user', 'ai_response')),
  reason text not null check (reason in ('spam', 'harassment', 'hate', 'sexual', 'violence', 'scam', 'self_harm', 'other')),
  note text,
  community_message_id uuid references public.community_messages(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  source text check (source is null or source in ('community', 'ask', 'mind', 'journal', 'challenge')),
  source_id uuid,
  created_at timestamptz not null default now(),
  check (char_length(coalesce(note, '')) <= 500),
  check (
    category in ('community_message', 'community_user')
    or (category = 'ai_response' and source is not null and source_id is not null)
  )
);

create index if not exists moderation_reports_created_idx
  on public.moderation_reports (created_at desc);
create index if not exists moderation_reports_target_idx
  on public.moderation_reports (target_user_id, created_at desc);

alter table public.user_blocks enable row level security;
alter table public.moderation_reports enable row level security;

drop policy if exists user_blocks_select_own on public.user_blocks;
create policy user_blocks_select_own on public.user_blocks
for select to authenticated
using (blocker_user_id = (select auth.uid()));

drop policy if exists user_blocks_insert_own on public.user_blocks;
create policy user_blocks_insert_own on public.user_blocks
for insert to authenticated
with check (blocker_user_id = (select auth.uid()) and blocked_user_id <> (select auth.uid()));

drop policy if exists user_blocks_update_own on public.user_blocks;
create policy user_blocks_update_own on public.user_blocks
for update to authenticated
using (blocker_user_id = (select auth.uid()))
with check (blocker_user_id = (select auth.uid()) and blocked_user_id <> (select auth.uid()));

drop policy if exists user_blocks_delete_own on public.user_blocks;
create policy user_blocks_delete_own on public.user_blocks
for delete to authenticated
using (blocker_user_id = (select auth.uid()));

-- Report submission is performed through the SECURITY DEFINER function below. This keeps
-- ownership, rate limits, duplicate handling, and the insert atomic even if a client bypasses
-- the app API and calls Supabase directly.
drop policy if exists moderation_reports_insert_own on public.moderation_reports;
revoke insert on public.moderation_reports from anon, authenticated;

-- A reporter may read only their own rows so the API can enforce a small rate and
-- duplicate guard. The app never exposes that query or report contents in its UI.
drop policy if exists moderation_reports_select_own on public.moderation_reports;
create policy moderation_reports_select_own on public.moderation_reports
for select to authenticated
using (reporter_user_id = (select auth.uid()));

revoke update, delete on public.moderation_reports from anon, authenticated;
revoke select on public.moderation_reports from anon;

create or replace function public.submit_moderation_report(
  p_category text,
  p_reason text,
  p_note text default null,
  p_community_message_id uuid default null,
  p_target_user_id uuid default null,
  p_source text default null,
  p_source_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_target uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_note is not null and char_length(p_note) > 500 then raise exception 'invalid_report'; end if;

  if p_category in ('community_message', 'community_user') then
    select user_id into v_target from public.community_messages where id = p_community_message_id;
    if not found then return 'target_not_found'; end if;
    if p_target_user_id is null or p_target_user_id <> v_target or v_target = v_user then return 'target_invalid'; end if;
  elsif p_category = 'ai_response' then
    if p_source = 'ask' then
      select s.user_id into v_target from public.chat_messages m join public.chat_sessions s on s.id = m.session_id
      where m.id = p_source_id and m.role = 'assistant' and s.user_id = v_user;
    elsif p_source = 'mind' then
      select s.user_id into v_target from public.psychology_session_messages m join public.psychology_sessions s on s.id = m.session_id
      where m.id = p_source_id and m.role = 'coach' and s.user_id = v_user;
    elsif p_source = 'journal' then
      select user_id into v_target from public.journal_insights where id = p_source_id and user_id = v_user;
    elsif p_source = 'challenge' then
      select user_id into v_target from public.challenge_config where id = p_source_id and user_id = v_user;
    end if;
    if v_target is null then return 'target_not_found'; end if;
  else
    return 'invalid_report';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  if (select count(*) from public.moderation_reports where reporter_user_id = v_user and created_at >= now() - interval '1 hour') >= 20 then
    return 'rate_limited';
  end if;
  if exists (
    select 1 from public.moderation_reports
    where reporter_user_id = v_user and category = p_category and reason = p_reason and created_at >= now() - interval '24 hours'
      and ((p_category = 'ai_response' and source = p_source and source_id = p_source_id)
        or (p_category <> 'ai_response' and community_message_id = p_community_message_id))
  ) then return 'duplicate'; end if;

  insert into public.moderation_reports (reporter_user_id, category, reason, note, community_message_id, target_user_id, source, source_id)
  values (v_user, p_category, p_reason, nullif(trim(p_note), ''), p_community_message_id, p_target_user_id, p_source, p_source_id);
  return 'submitted';
end;
$$;

revoke all on function public.submit_moderation_report(text, text, text, uuid, uuid, text, uuid) from public;
grant execute on function public.submit_moderation_report(text, text, text, uuid, uuid, text, uuid) to authenticated;

-- Account deletion should remove a user's personal blocks and reports automatically.
