alter table public.chat_sessions
  add column if not exists memory_summary jsonb,
  add column if not exists memory_updated_at timestamptz;

comment on column public.chat_sessions.memory_summary is
  'Structured Ask memory summary used to augment recent chat turns.';

comment on column public.chat_sessions.memory_updated_at is
  'Timestamp for the latest Ask memory summary refresh.';
