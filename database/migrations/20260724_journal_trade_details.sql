-- Optional structured trade details for a journal entry (asset, direction, entry/SL/TP,
-- position size, entry time, timeframe). One nullable jsonb column mirrors the existing
-- jsonb style (challenge_config.rules); the mobile client stores whatever the trader fills
-- in, all fields optional. Nothing reads it server-side yet — it round-trips for edit.
alter table public.journal_entries
  add column if not exists trade_details jsonb;
