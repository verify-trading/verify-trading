-- Members Chat: image messages, emoji reactions, and an admin add-by-email RPC.
-- Builds on 20260602_community_chat.sql. Additive / non-destructive.

-- ---------------------------------------------------------------------------
-- 1. Image messages
-- ---------------------------------------------------------------------------

alter table public.community_messages
  add column if not exists image_url text;

-- Allow image-only messages (empty/null body). Replace the original 1..2000 check.
alter table public.community_messages alter column body drop not null;
alter table public.community_messages drop constraint if exists community_messages_body_check;
alter table public.community_messages
  add constraint community_messages_body_len check (body is null or char_length(body) <= 2000);
alter table public.community_messages
  add constraint community_messages_has_content check (coalesce(body, '') <> '' or image_url is not null);

-- Moderation trigger: guard null body before the link-strip regex.
create or replace function public.community_messages_moderate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_community_member(new.room_id, new.user_id) then
    raise exception 'Not an active member of this room.' using errcode = '42501';
  end if;

  new.author_name := coalesce(
    (select display_name from public.profiles where id = new.user_id),
    'Member'
  );

  if new.body is not null and not public.is_community_admin(new.room_id, new.user_id) then
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

-- ---------------------------------------------------------------------------
-- 2. Storage bucket for chat images (private; members read via signed URLs)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-images', 'community-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Path layout: {room_id}/{user_id}/{file}. Insert into your own folder in a room
-- you're a member of; read any image in a room you're a member of.
drop policy if exists "community_images_insert" on storage.objects;
create policy "community_images_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'community-images'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.is_community_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

drop policy if exists "community_images_select" on storage.objects;
create policy "community_images_select" on storage.objects
for select to authenticated
using (
  bucket_id = 'community-images'
  and public.is_community_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

-- ---------------------------------------------------------------------------
-- 3. Emoji reactions
-- ---------------------------------------------------------------------------

create table if not exists public.community_message_reactions (
  message_id uuid not null references public.community_messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create index if not exists community_message_reactions_message_idx
  on public.community_message_reactions (message_id);

alter table public.community_message_reactions enable row level security;

-- Members of the message's room can read reactions.
drop policy if exists community_reactions_select on public.community_message_reactions;
create policy community_reactions_select on public.community_message_reactions
for select to authenticated
using (exists (
  select 1 from public.community_messages m
  where m.id = message_id and public.is_community_member(m.room_id, auth.uid())
));

-- You add/remove your own reactions (in a room you're a member of).
drop policy if exists community_reactions_insert on public.community_message_reactions;
create policy community_reactions_insert on public.community_message_reactions
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.community_messages m
    where m.id = message_id and public.is_community_member(m.room_id, auth.uid())
  )
);

drop policy if exists community_reactions_delete on public.community_message_reactions;
create policy community_reactions_delete on public.community_message_reactions
for delete to authenticated
using (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'community_message_reactions'
  ) then
    alter publication supabase_realtime add table public.community_message_reactions;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Admin: add a member by email
-- ---------------------------------------------------------------------------

create or replace function public.community_add_member_by_email(p_slug text, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.community_rooms;
  v_uid uuid := auth.uid();
  v_target uuid;
begin
  select * into v_room from public.community_rooms where slug = p_slug and is_active;
  if not found then
    raise exception 'Room not found.' using errcode = 'P0002';
  end if;

  if not public.is_community_admin(v_room.id, v_uid) then
    raise exception 'Admins only.' using errcode = '42501';
  end if;

  select id into v_target from auth.users where lower(email) = lower(trim(p_email));
  if v_target is null then
    raise exception 'No user with that email.' using errcode = 'P0002';
  end if;

  insert into public.community_members (room_id, user_id, role, status)
  values (v_room.id, v_target, 'member', 'active')
  on conflict (room_id, user_id) do update set status = 'active';
end;
$$;
