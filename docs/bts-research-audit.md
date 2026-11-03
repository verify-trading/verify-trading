# BTS research recovery and validation — 3 November 2026

The three original research CSVs reproduce all 1,860 supplied engine outputs exactly using the supplied configuration and a fixed 30 October 2026 scoring date. This verifies the import and calculations; it does not represent a fresh independent verification of every factual claim.

## Applied data work

- Backed up all 1,860 `bts_scores`, 67,871 `bts_country_fit`, 1,564 `verified_entities` and four live-assessment rows before changes. Private backups include row counts and SHA-256 checksums.
- Imported 1,013 brokers, 414 prop firms and 433 tools into three private staging tables. Broker `regulatory_licences_json` is JSONB, validated as an array. The complete original research row is retained as JSONB.
- Attached the source research, historical source links and a reproducible audit to the existing score records without changing any score, uncapped aggregate, verdict, confidence, cap or scoring-version column.
- Restored 7,872 historical source-link associations covering 1,849 records. Eleven original research rows contain no source links; all eleven are unknown or needs-review, and cannot receive a positive assessment.
- Compared TTS/guru records against the full backup: unchanged. No TTS code or scoring rules were edited.

The CSVs and database dumps are confidential and remain outside Git. Staging tables have RLS, no public policies, and no anonymous/authenticated table privileges.

## Cap-policy review

The original engine applies hard global caps from free-text action classifications. The reproduced output is faithful to that configuration, but fidelity does not establish that each finding matches the current operator or every jurisdiction.

The audit flags 262 regulatory caps for legal-entity, jurisdiction and outcome review, including 27 broker caps whose dedicated action-source field is empty. Secondary-source caveats are retained rather than silently upgraded to primary verification. A warning about authorisation in one jurisdiction does not establish worldwide fraud; a simulated evaluation service is distinguished from a broker holding client money. No cap has been removed simply to raise a score.

Elites Funding's imported record relies on an InfoCons reproduction and notes that the original ASF page was not checked during that research. The separately validated Layer 2 result links to the original ASF directory. Alpari's original action text includes Alpari Limited, Alpari (UK) Limited and historical events while the current operator field names Parlance Trading Ltd. These require scoped explanations rather than transferring all actions to the current operator.

Original source links now appear as **Historical research sources**, with their research date. They are not labelled as freshly checked. A complete research status and a full numeric pillar score do not prove source reliability or independently verified payouts.

## Hard rules and duplicate handling

- `needs_review`: no live scoring run or positive card; Ask says “We're still verifying this firm.” The final-card merge cannot replace this with model-written praise.
- Inactive, redirected, merged, closed and unknown operators cannot receive positive labels. Public detail pages, ranked lists and Ask share the gate.
- Clone warnings remain notices about impersonators rather than adverse findings against the legitimate operator.
- Firm name matches must be exact names or known aliases. A supplied website that differs from the researched operator's website cannot inherit that operator's card. TTS resolution is unchanged.
- Public lists collapse shared engine IDs. They additionally collapse conservative name variants only at the exact same website and legal identity. Uprofit/UpProfit is an explicit spelling alias present in the source data. Different products, legal entities, and HyperFunding/HyperFunded remain separate. Shared websites alone never trigger a merge.
- Sixteen exact-website groups were recorded as duplicate candidates. Historical records and their scores remain intact; potentially distinct products and operators are not deleted.
- Ask receives the researched operator, licence holders, permitted activities/client scope, servicing regions, terms, actions, dates and sources. The IP country is a hint; it cannot establish residence or account protections.

## Repeatable checks

Prepare a private, audited manifest with the supplied engine ZIP:

```sh
python3 scripts/data/audit-bts-research.py \
  --research-dir /path/to/research \
  --engine-zip '/path/to/BTS_scoring_engine_v2 (1).zip' \
  --out-dir /private/audit-output
```

Import after applying the staging migration. The default command creates a full backup and performs a dry run; `--apply` enables writes. An existing backup directory is not overwritten.

```sh
node --env-file=.env.local scripts/data/import-bts-research.mjs \
  --manifest /private/audit-output/research-manifest.json \
  --backup-dir /private/new-backup-directory --apply
```

Read-only production data validation:

```sh
RUN_BTS_RESEARCH_QA=1 BTS_QA_BACKUP_DIR=/private/backup-directory \
  npx vitest run tests/manual/bts-research-qa.test.ts
```

Remaining factual work is explicit: fresh independent revalidation of all original claims and adjudication of the flagged cap scopes. Recovered URLs and reproducible arithmetic are not substituted for that work. Existing approved numeric scores remain historical baselines; successful Layer 2 checks provide separately sourced current assessments.
