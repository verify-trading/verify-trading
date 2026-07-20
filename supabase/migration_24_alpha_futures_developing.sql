-- Alpha Futures is a distinct futures prop firm, not Alpha Capital Group.
-- The existing Alpha Futures record has the compact slug `alphafutures`; update
-- only that row so this migration can never create a duplicate or alter ACG.

update public.verified_entities
set
  status = 'warning',
  trust_score = null,
  notes =
  'Developing record: no final trust score while the payout position is unverified.',
  source = 'Alpha Futures monitoring record',
  aliases = jsonb_build_array('alpha futures', 'alphafutures'),
  founder_notes = 'Confirmed: active Premium accounts are being closed and refunded. Confirmed: Tradovate is no longer a purchase option. The payout-denial and technical-bug claims are unconfirmed and are not recorded as fact.',
  firm_status = 'Operating — monitoring',
  trustpilot_rating = 4.9,
  trustpilot_count = 5330,
  trustpilot_date = date '2026-07-08',
  research_status = 'DEVELOPING — MONITOR',
  card_facts = jsonb_build_object(
    'confirmed', jsonb_build_array(
      jsonb_build_object(
        'text', 'Active Premium accounts are being closed and refunded.',
        'sourceLabel', 'Alpha Futures Help Center',
        'sourceUrl', 'https://help.alpha-futures.com/en/articles/14851994-premium-account-overview'
      ),
      jsonb_build_object(
        'text', 'Tradovate is no longer offered for new Alpha account purchases.',
        'sourceLabel', 'PickAPropFirm tracker',
        'sourceUrl', 'https://x.com/jmutrades/status/2076324792001560606'
      )
    ),
    'unconfirmed', jsonb_build_array(
      'The payout-denial claim is unconfirmed; it comes only from one secondhand video with a self-described "inside source".',
      'The technical-bug claim is unconfirmed; it comes only from that same secondhand video and is not recorded as fact.'
    ),
    'footer', 'Re-verify when Alpha publishes its official statement (Jmu expects roughly 24 hours): it should confirm or contradict the payout-denial claim, the most decision-relevant and currently weakest-evidenced point.'
  )
)
where slug = 'alphafutures'
  and entity_type = 'propfirm';
