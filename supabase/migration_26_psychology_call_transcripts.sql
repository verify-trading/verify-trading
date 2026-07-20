-- Migration 26 — persist two-way psychology voice-call transcripts
--
-- Apply on the production database (Supabase SQL editor). Idempotent; safe to
-- re-run.
--
-- Problem: every voice-call turn inserts a contentless psychology_sessions row
-- (message_count hardcoded to 1, duration_secs never set), so a single call
-- leaves N junk rows and no transcript of what was actually said.
--
-- Fix: a psychology_session_messages table stores both sides of the call
-- ('user' and 'coach' turns) against ONE psychology_sessions row per call. The
-- companion route now creates that row up front (mode 'greeting'), appends the
-- transcript per turn, and keeps message_count / break_recommended current;
-- PATCH /api/psychology/sessions/[id] records duration_secs at hang-up.
--
-- The API routes run with the caller's user-scoped Supabase client (cookie
-- session or mobile Bearer token — see getSessionUser), so RLS applies to every
-- read/write. The new table gets select-own / insert-own policies mirroring
-- psychology_sessions, and psychology_sessions gains a NEW update-own policy —
-- it previously had only select/insert, which would block the per-turn
-- message_count / break_recommended updates and the duration_secs PATCH.

create table if not exists public.psychology_session_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.psychology_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'coach')),
  content text not null,
  created_at timestamptz not null default now()
);

-- Transcript reads are always "all messages for one session, oldest first".
create index if not exists psychology_session_messages_session_created_idx
  on public.psychology_session_messages (session_id, created_at);

alter table public.psychology_session_messages enable row level security;

drop policy if exists "psychology_session_messages_select_own" on public.psychology_session_messages;
create policy "psychology_session_messages_select_own"
on public.psychology_session_messages
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "psychology_session_messages_insert_own" on public.psychology_session_messages;
create policy "psychology_session_messages_insert_own"
on public.psychology_session_messages
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "psychology_sessions_update_own" on public.psychology_sessions;
create policy "psychology_sessions_update_own"
on public.psychology_sessions
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
