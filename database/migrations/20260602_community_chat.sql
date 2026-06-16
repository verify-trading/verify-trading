-- Community Members Chat — Pro-only, Supabase Realtime powered.
-- Namespaced community_* to avoid colliding with the Ask AI chat (chat_messages/chat_sessions).
-- One room for launch ('main'); sub-rooms later = additional community_rooms rows.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.community_rooms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.community_members (
  room_id uuid not null references public.community_rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin')),
  status text not null default 'active' check (status in ('active', 'banned')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists community_members_user_idx on public.community_members (user_id);

create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.community_rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  author_name text,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists community_messages_room_created_idx
  on public.community_messages (room_id, created_at desc);

-- Seed the launch room.
insert into public.community_rooms (slug, name, description, sort_order)
values (
  'main',
  'Members Chat',
  'Verified Pro traders helping traders. No signals. No promotions. No broker recommendations without a BTS score.',
  0
)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so RLS policies don't recurse)
-- ---------------------------------------------------------------------------

create or replace function public.is_pro(p_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user and p.tier = 'pro'
  );
$$;

create or replace function public.is_community_member(p_room uuid, p_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.community_members m
    where m.room_id = p_room and m.user_id = p_user and m.status = 'active'
  );
$$;

create or replace function public.is_community_admin(p_room uuid, p_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.community_members m
    where m.room_id = p_room
      and m.user_id = p_user
      and m.role = 'admin'
      and m.status = 'active'
  );
$$;

-- Pro members (and admins) join a room. Never re-activates a banned member.
create or replace function public.join_community_room(p_slug text)
returns public.community_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.community_rooms;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  select * into v_room from public.community_rooms where slug = p_slug and is_active;
  if not found then
    raise exception 'Room not found.' using errcode = 'P0002';
  end if;

  if not public.is_pro(v_uid) and not public.is_community_admin(v_room.id, v_uid) then
    raise exception 'Pro membership required.' using errcode = '42501';
  end if;

  insert into public.community_members (room_id, user_id, role, status)
  values (v_room.id, v_uid, 'member', 'active')
  on conflict (room_id, user_id) do nothing;

  return v_room;
end;
$$;

-- Moderation: stamp author name; strip links for non-admins (the "bot").
create or replace function public.community_messages_moderate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Defense in depth: RLS already restricts inserts to active members, but we
  -- re-check here so a future RLS misconfiguration can't bypass moderation.
  if not public.is_community_member(new.room_id, new.user_id) then
    raise exception 'Not an active member of this room.' using errcode = '42501';
  end if;

  new.author_name := coalesce(
    (select display_name from public.profiles where id = new.user_id),
    'Member'
  );

  if not public.is_community_admin(new.room_id, new.user_id) then
    -- Remove explicit URLs and bare domains for non-admins.
    new.body := regexp_replace(new.body, '(https?://|www\.)\S+', '[link removed]', 'gi');
    new.body := regexp_replace(
      new.body,
      '\m[a-z0-9-]+\.(com|net|org|io|me|co|xyz|app|link|gg|ru|info|biz|tv)\M\S*',
      '[link removed]',
      'gi'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists community_messages_moderate_trg on public.community_messages;
create trigger community_messages_moderate_trg
before insert on public.community_messages
for each row
execute function public.community_messages_moderate();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.community_rooms enable row level security;
alter table public.community_members enable row level security;
alter table public.community_messages enable row level security;

-- Rooms: visible to Pro members or existing room members.
drop policy if exists community_rooms_select on public.community_rooms;
create policy community_rooms_select on public.community_rooms
for select to authenticated
using (
  is_active and (public.is_pro(auth.uid()) or public.is_community_member(id, auth.uid()))
);

-- Members: a member can see the roster; you can always see your own row.
drop policy if exists community_members_select on public.community_members;
create policy community_members_select on public.community_members
for select to authenticated
using (user_id = auth.uid() or public.is_community_member(room_id, auth.uid()));

-- Members: admins add / ban / promote.
drop policy if exists community_members_admin_write on public.community_members;
create policy community_members_admin_write on public.community_members
for all to authenticated
using (public.is_community_admin(room_id, auth.uid()))
with check (public.is_community_admin(room_id, auth.uid()));

-- Messages: active members read.
drop policy if exists community_messages_select on public.community_messages;
create policy community_messages_select on public.community_messages
for select to authenticated
using (public.is_community_member(room_id, auth.uid()));

-- Messages: post your own as an active member.
drop policy if exists community_messages_insert on public.community_messages;
create policy community_messages_insert on public.community_messages
for insert to authenticated
with check (user_id = auth.uid() and public.is_community_member(room_id, auth.uid()));

-- Messages: author soft-deletes own; admins soft-delete any.
drop policy if exists community_messages_update on public.community_messages;
create policy community_messages_update on public.community_messages
for update to authenticated
using (user_id = auth.uid() or public.is_community_admin(room_id, auth.uid()))
with check (user_id = auth.uid() or public.is_community_admin(room_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'community_messages'
  ) then
    alter publication supabase_realtime add table public.community_messages;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin seeding — RUN MANUALLY with the real admin emails (Omar & Dan).
-- ---------------------------------------------------------------------------
-- insert into public.community_members (room_id, user_id, role, status)
-- select r.id, u.id, 'admin', 'active'
-- from public.community_rooms r
-- join auth.users u on u.email in ('omar@example.com', 'dan@example.com')
-- where r.slug = 'main'
-- on conflict (room_id, user_id) do update set role = 'admin', status = 'active';
