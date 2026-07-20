-- Migration 23: structured card facts for developing prop firms.
-- card_facts shape:
-- {
--   "confirmed": [{ "text": "...", "sourceLabel": "...", "sourceUrl": "https://..." }],
--   "unconfirmed": ["..."],
--   "footer": "..."
-- }
-- Rendered verbatim on the Firm Check card instead of a free-text verdict so the
-- model can never invent stats for firms whose research is still developing.

ALTER TABLE verified_entities ADD COLUMN IF NOT EXISTS card_facts jsonb;
