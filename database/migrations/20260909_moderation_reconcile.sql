-- Corrective migration for moderation drafts that may already be applied.
-- Idempotent and additive: it does not drop tables or delete report/block rows.
-- Apply only after inspecting the live schema with the read-only query in the handoff.

alter table if exists public.moderation_reports
  add column if not exists community_message_id uuid,
  add column if not exists target_user_id uuid,
  add column if not exists source text,
  add column if not exists source_id uuid;

-- Earlier drafts used an unnamed CHECK requiring community_message_id. That conflicts with
-- ON DELETE SET NULL and can prevent account/message deletion. Remove only that old CHECK by
-- its definition, regardless of the generated constraint name, then add the final named form.
do $$
declare
  c record;
begin
  if to_regclass('public.moderation_reports') is not null then
    for c in
      select conname
      from pg_constraint
      where conrelid = 'public.moderation_reports'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%community_message_id%is not null%'
    loop
      execute format('alter table public.moderation_reports drop constraint %I', c.conname);
    end loop;
  end if;
end $$;

do $$
begin
  if to_regclass('public.moderation_reports') is not null
     and not exists (
       select 1 from pg_constraint
       where conrelid = 'public.moderation_reports'::regclass
         and conname = 'moderation_reports_target_check'
     ) then
    alter table public.moderation_reports
      add constraint moderation_reports_target_check check (
        category in ('community_message', 'community_user')
        or (category = 'ai_response' and source is not null and source_id is not null)
      );
  end if;
end $$;

alter table if exists public.user_blocks enable row level security;
alter table if exists public.moderation_reports enable row level security;

drop policy if exists user_blocks_select_own on public.user_blocks;
create policy user_blocks_select_own on public.user_blocks
for select to authenticated using (blocker_user_id = (select auth.uid()));

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
for delete to authenticated using (blocker_user_id = (select auth.uid()));

-- Reports must be submitted through this function. Direct table writes would bypass the API's
-- target-ownership, duplicate, and rate-limit checks. Existing rows remain untouched.
drop policy if exists moderation_reports_insert_own on public.moderation_reports;
revoke insert, update, delete on public.moderation_reports from anon, authenticated;
revoke select on public.moderation_reports from anon;

drop policy if exists moderation_reports_select_own on public.moderation_reports;
create policy moderation_reports_select_own on public.moderation_reports
for select to authenticated using (reporter_user_id = (select auth.uid()));

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
      select s.user_id into v_target from public.chat_messages m
      join public.chat_sessions s on s.id = m.session_id
      where m.id = p_source_id and m.role = 'assistant' and s.user_id = v_user;
    elsif p_source = 'mind' then
      select s.user_id into v_target from public.psychology_session_messages m
      join public.psychology_sessions s on s.id = m.session_id
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
  if (select count(*) from public.moderation_reports
      where reporter_user_id = v_user and created_at >= now() - interval '1 hour') >= 20 then
    return 'rate_limited';
  end if;
  if exists (
    select 1 from public.moderation_reports
    where reporter_user_id = v_user and category = p_category and reason = p_reason
      and created_at >= now() - interval '24 hours'
      and ((p_category = 'ai_response' and source = p_source and source_id = p_source_id)
        or (p_category <> 'ai_response' and community_message_id = p_community_message_id))
  ) then return 'duplicate'; end if;

  insert into public.moderation_reports
    (reporter_user_id, category, reason, note, community_message_id, target_user_id, source, source_id)
  values (v_user, p_category, p_reason, nullif(trim(p_note), ''), p_community_message_id,
          p_target_user_id, p_source, p_source_id);
  return 'submitted';
end;
$$;

revoke all on function public.submit_moderation_report(text, text, text, uuid, uuid, text, uuid) from public;
grant execute on function public.submit_moderation_report(text, text, text, uuid, uuid, text, uuid) to authenticated;

-- Reporting an AI answer needs its own vocabulary (inaccurate / harmful_advice / offensive);
-- the original CHECK only knew the community-UGC reasons. Same approach as the CHECK above:
-- the constraint was created unnamed, so find it by definition rather than by a guessed name.
do $$
declare
  c record;
begin
  if to_regclass('public.moderation_reports') is not null then
    for c in
      select conname
      from pg_constraint
      where conrelid = 'public.moderation_reports'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%reason%'
        and pg_get_constraintdef(oid) not ilike '%inaccurate%'
    loop
      execute format('alter table public.moderation_reports drop constraint %I', c.conname);
    end loop;

    if not exists (
      select 1 from pg_constraint
      where conrelid = 'public.moderation_reports'::regclass and conname = 'moderation_reports_reason_check'
    ) then
      alter table public.moderation_reports
        add constraint moderation_reports_reason_check
        check (reason in ('spam', 'harassment', 'hate', 'sexual', 'violence', 'scam', 'self_harm',
                          'inaccurate', 'harmful_advice', 'offensive', 'other'));
    end if;
  end if;
end $$;
