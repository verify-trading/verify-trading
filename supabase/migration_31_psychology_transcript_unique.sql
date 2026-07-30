-- Migration 31 — one transcript per call, enforced by the database
--
-- Apply on the production database (Supabase SQL editor). Idempotent; safe to
-- re-run.
--
-- Problem: two paths import an ElevenLabs transcript into the same session — the
-- hang-up PATCH and the GET repair — and both guard with check-then-insert
-- ("does this session have messages yet?"). Between that check and the insert
-- sits an ElevenLabs round trip of up to 10 seconds, so a trader who opens the
-- call while the hang-up report is still in flight (or opens it on two devices)
-- can have the whole transcript inserted twice. Application code cannot close
-- that window; only the database can.
--
-- Fix: the importer now stamps created_at deterministically from the session's
-- own created_at (base + one millisecond per turn), so the same transcript
-- always produces the same timestamps whoever stores it. This unique index then
-- makes the second writer's insert fail instead of duplicating the call. The
-- loser's request logs and returns the session with no messages; the next read
-- shows the winner's rows.
--
-- Verified before writing this: production currently has no duplicate
-- (session_id, created_at) pairs, so the index builds cleanly. If it ever fails
-- with "could not create unique index", find the offenders first:
--
--   select session_id, created_at, count(*)
--   from public.psychology_session_messages
--   group by 1, 2 having count(*) > 1;
--
-- The turn-based companion path is unaffected: it writes its user turn and its
-- coach turn in separate statements with a model call between them, so they
-- never share a transaction timestamp.

create unique index if not exists psychology_session_messages_session_created_key
  on public.psychology_session_messages (session_id, created_at);

-- Migration 26's plain index covered exactly these columns in the same order, so
-- the unique one above already serves every read it served.
drop index if exists public.psychology_session_messages_session_created_idx;
