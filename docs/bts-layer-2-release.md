# BTS Layer 2 release — 3 November 2026

Specific broker and prop-firm checks now independently research live evidence using the configured GPT model. Code validates retrieved source URLs, totals five versioned rubric pillars, derives the verdict and computes evidence confidence. Unknown firms can receive a score without a Layer 1 row. Ask displays one final score, with expandable source links and dated findings identifying the authority, entity, jurisdiction and outcome.

## Baseline and audit

The approved Layer 1 CSV scores and scoring configuration are preserved. Elites Funding remains 25/100 in Layer 1, with an uncapped aggregate of 86 and the original scoring-policy version in `bts_scores`. Its warning cap follows the supplied engine's global warning/action rule; that rule does not distinguish Romanian authorisation requirements from simulated evaluation services. This explains the existing cap; it is not a finding that every service is illegal worldwide. Reclassification of the approved Layer 1 policy remains a methodology review, not an automatic score increase.

Layer 2 does not inherit that cap or see the baseline during research. New runs store the baseline score alongside the independently calculated final score in `bts_l2_assessments`; private raw data also retains retrieved URLs and a snapshot of the baseline's uncapped score, cap and policy version. The table has RLS and no public policies.

The original Layer 1 confidence calculation rewards completed research fields and source counts. Public detail pages now show the explicitly named pillar research coverage instead of presenting that figure as source reliability. Layer 2 confidence separately uses the reliability of evidence supporting each pillar. No payout/dispute pillar earns full marks solely because no complaints were found.

## Sources rechecked

- [ASF original investor alerts](https://www.asfromania.ro/ro/a/19/alerte-investitori---informari): the 17 October 2024 entry names MASTERLABS LIMITED, Elites Funding and elitesfunding.com. It concerns Romanian investment-services authorisation; it does not establish fraud or resolve the classification of simulated evaluations.
- [Elites Funding terms](https://elitesfunding.com/terms-of-use/): simulation, payout discretion, account termination and rule changes are material contractual risks.
- [Trustpilot profile](https://www.trustpilot.com/review/elitesfunding.com): rating unavailable for a guidelines breach and fake-review removals. Customer allegations and company responses must remain distinguished from adjudicated findings.

Not every imported Layer 1 cap includes its original source URL. Layer 2 supplies current source-by-source findings; a complete historical source backfill across all imported firms is not asserted by this release.

## Product changes

- Prop-firm positive baseline badges read “Record reviewed”, with neutral styling.
- Public lists and detail pages use global stored scores and omit the country selector, per the latest product instruction. Ask still evaluates explicitly requested countries and keeps availability separate from the overall score.
- Numeric score cells stay on one line and align across rows; smaller screens use cards.
- A successful live result clears obsolete developing flags and old trust bands so they cannot hide or contradict its score.
- Failed or slow live checks show the stored assessment with the explicit live-unavailable notice; they are not cached as successful live answers. No unsupported Claude web-search fallback is claimed.

## Operation and verification

Migration: `supabase/migration_37_bts_l2_assessments.sql` (confirmed applied).

Model: `BTS_L2_MODEL`, default `gpt-6.1-terra`; `BTS_L2_REASONING` defaults to `low` (the tested latency setting). Ask chat retains its existing model. Live runs can take around two minutes; Ask waits up to 120 seconds, with a longer run allowed to finish into the cache. Cached assessments expire after 24 hours and are keyed by subject, country, model and rubric version. Concurrent requests within one server process share a run.

Manual integration check (real research and database write):

```sh
RUN_BTS_L2_SMOKE=1 BTS_SMOKE_FIRM='Elites Funding' npx vitest run tests/manual/bts-l2-smoke.test.ts
```

Earlier live checks produced Elites Funding 37/100 (confidence 70) and TMGM 56/100, with retrieved evidence and successful cache reuse. Scores are measured outputs, not hardcoded targets. A later gateway request returned “Service temporarily unavailable”; the stored-assessment fallback remains necessary. The final opt-in test passed with the low reasoning setting, including the actual verification-card path and cached source metadata. No claim is made that the upstream gateway is always available.
