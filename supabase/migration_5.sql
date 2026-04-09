-- Enforce user-owned Ask sessions and clean up orphaned rows.

delete from public.chat_sessions
where user_id is null;

alter table public.chat_sessions
  alter column user_id set not null;

alter table public.chat_sessions
  drop constraint if exists chat_sessions_user_id_fkey;

alter table public.chat_sessions
  add constraint chat_sessions_user_id_fkey
  foreign key (user_id)
  references auth.users (id)
  on delete cascade;
