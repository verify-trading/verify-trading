create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop policy if exists "chat_sessions_select_own" on public.chat_sessions;
create policy "chat_sessions_select_own"
on public.chat_sessions
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "chat_sessions_insert_own" on public.chat_sessions;
create policy "chat_sessions_insert_own"
on public.chat_sessions
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "chat_sessions_update_own" on public.chat_sessions;
create policy "chat_sessions_update_own"
on public.chat_sessions
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "chat_sessions_delete_own" on public.chat_sessions;
create policy "chat_sessions_delete_own"
on public.chat_sessions
for delete
to authenticated
using (user_id = (select auth.uid()));

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
      and chat_sessions.user_id = (select auth.uid())
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
      and chat_sessions.user_id = (select auth.uid())
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
      and chat_sessions.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.chat_sessions
    where chat_sessions.id = chat_messages.session_id
      and chat_sessions.user_id = (select auth.uid())
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
      and chat_sessions.user_id = (select auth.uid())
  )
);
