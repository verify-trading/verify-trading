-- Migration 30 — keep the ElevenLabs conversation id on the session row
--
-- Apply on the production database (Supabase SQL editor). Idempotent; safe to
-- re-run.
--
-- Problem: the conversation id arrives once, in the hang-up PATCH, is used for a
-- single transcript fetch, and is then discarded. ElevenLabs often has not
-- finalised the transcript at that instant, so the fetch returns nothing — and
-- with the id gone there is no way to ever ask again. The session is stranded at
-- 0 messages permanently, showing a real duration and "Nothing was said on this
-- call." Observed on 4 of 7 recent calls, including one lasting 1:37.
--
-- Fix: persist the id (only after its signed vt_ctx has been verified to bind to
-- this user + session, so a forged id can never be stored), which lets a later
-- read refetch the transcript and repair the session.

alter table public.psychology_sessions
  add column if not exists elevenlabs_conversation_id text;
