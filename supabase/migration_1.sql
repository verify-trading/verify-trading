create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  title text not null default 'New Ask Session',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chat_sessions
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists title text not null default 'New Ask Session',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  card_payload jsonb,
  ui_meta jsonb,
  attachment_meta jsonb,
  created_at timestamptz not null default now()
);

alter table public.chat_messages
  add column if not exists card_payload jsonb,
  add column if not exists ui_meta jsonb,
  add column if not exists attachment_meta jsonb,
  add column if not exists created_at timestamptz not null default now();

create index if not exists chat_sessions_user_updated_idx
  on public.chat_sessions (user_id, updated_at desc);

create index if not exists chat_messages_session_created_idx
  on public.chat_messages (session_id, created_at desc, id desc);

create table if not exists public.verified_entities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  entity_type text not null check (entity_type in ('broker', 'guru', 'propfirm')),
  status text not null check (status in ('legitimate', 'warning', 'avoid')),
  fca_registered boolean not null default false,
  fca_reference text,
  fca_warning boolean not null default false,
  trust_score numeric(3, 1) not null,
  notes text not null,
  source text not null,
  aliases text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.verified_entities
  add column if not exists slug text,
  add column if not exists name text,
  add column if not exists entity_type text,
  add column if not exists status text,
  add column if not exists fca_registered boolean not null default false,
  add column if not exists fca_reference text,
  add column if not exists fca_warning boolean not null default false,
  add column if not exists trust_score numeric(3, 1),
  add column if not exists notes text,
  add column if not exists source text,
  add column if not exists aliases text[] not null default '{}',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'verified_entities_entity_type_check'
  ) then
    alter table public.verified_entities
      add constraint verified_entities_entity_type_check
      check (entity_type in ('broker', 'guru', 'propfirm'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'verified_entities_status_check'
  ) then
    alter table public.verified_entities
      add constraint verified_entities_status_check
      check (status in ('legitimate', 'warning', 'avoid'));
  end if;
end $$;

create index if not exists verified_entities_type_idx
  on public.verified_entities (entity_type);

create index if not exists verified_entities_slug_idx
  on public.verified_entities (slug);

create table if not exists public.broker_entity_map (
  id uuid primary key default gen_random_uuid(),
  entity_slug text not null references public.verified_entities(slug) on delete cascade,
  broker_name text not null,
  fca_reference text,
  created_at timestamptz not null default now(),
  unique (entity_slug),
  unique (broker_name)
);

alter table public.broker_entity_map
  add column if not exists entity_slug text,
  add column if not exists broker_name text,
  add column if not exists fca_reference text,
  add column if not exists created_at timestamptz not null default now();

create index if not exists broker_entity_map_fca_reference_idx
  on public.broker_entity_map (fca_reference);

drop trigger if exists set_chat_sessions_updated_at on public.chat_sessions;
create trigger set_chat_sessions_updated_at
before update on public.chat_sessions
for each row
execute function public.set_updated_at();

drop trigger if exists set_verified_entities_updated_at on public.verified_entities;
create trigger set_verified_entities_updated_at
before update on public.verified_entities
for each row
execute function public.set_updated_at();

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'ask-attachments',
  'ask-attachments',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.verified_entities enable row level security;
alter table public.broker_entity_map enable row level security;

drop policy if exists "chat_sessions_select_own" on public.chat_sessions;
create policy "chat_sessions_select_own"
on public.chat_sessions
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "chat_sessions_insert_own" on public.chat_sessions;
create policy "chat_sessions_insert_own"
on public.chat_sessions
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "chat_sessions_update_own" on public.chat_sessions;
create policy "chat_sessions_update_own"
on public.chat_sessions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "chat_sessions_delete_own" on public.chat_sessions;
create policy "chat_sessions_delete_own"
on public.chat_sessions
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "chat_messages_select_session_owner" on public.chat_messages;
create policy "chat_messages_select_session_owner"
on public.chat_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.chat_sessions
    where chat_sessions.id = chat_messages.session_id
      and chat_sessions.user_id = auth.uid()
  )
);

drop policy if exists "chat_messages_insert_session_owner" on public.chat_messages;
create policy "chat_messages_insert_session_owner"
on public.chat_messages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.chat_sessions
    where chat_sessions.id = chat_messages.session_id
      and chat_sessions.user_id = auth.uid()
  )
);

drop policy if exists "chat_messages_update_session_owner" on public.chat_messages;
create policy "chat_messages_update_session_owner"
on public.chat_messages
for update
to authenticated
using (
  exists (
    select 1
    from public.chat_sessions
    where chat_sessions.id = chat_messages.session_id
      and chat_sessions.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.chat_sessions
    where chat_sessions.id = chat_messages.session_id
      and chat_sessions.user_id = auth.uid()
  )
);

drop policy if exists "chat_messages_delete_session_owner" on public.chat_messages;
create policy "chat_messages_delete_session_owner"
on public.chat_messages
for delete
to authenticated
using (
  exists (
    select 1
    from public.chat_sessions
    where chat_sessions.id = chat_messages.session_id
      and chat_sessions.user_id = auth.uid()
  )
);

drop policy if exists "verified_entities_read_authenticated" on public.verified_entities;
create policy "verified_entities_read_authenticated"
on public.verified_entities
for select
to authenticated
using (true);

drop policy if exists "broker_entity_map_read_authenticated" on public.broker_entity_map;
create policy "broker_entity_map_read_authenticated"
on public.broker_entity_map
for select
to authenticated
using (true);

drop policy if exists "ask_attachments_insert_own_folder" on storage.objects;
create policy "ask_attachments_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'ask-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "ask_attachments_select_own_folder" on storage.objects;
create policy "ask_attachments_select_own_folder"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'ask-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "ask_attachments_update_own_folder" on storage.objects;
create policy "ask_attachments_update_own_folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'ask-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'ask-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "ask_attachments_delete_own_folder" on storage.objects;
create policy "ask_attachments_delete_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'ask-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);
