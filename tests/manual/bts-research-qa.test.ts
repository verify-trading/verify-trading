/** Opt-in read-only checks against all imported records. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { loadDotEnvLocal } from './env-local';

loadDotEnvLocal();
const enabled = process.env.RUN_BTS_RESEARCH_QA === '1';

describe.skipIf(!enabled)('imported BTS research QA', () => {
  it('checks staging, every public firm status, original score preservation and TTS', async () => {
    const { toPublicEntity } = await import('@/lib/compare/entities');
    const { btsVerificationGate } = await import('@/lib/compare/bts-research');
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const all = async (table: string, key: string) => {
      const rows: Array<Record<string, unknown>> = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await client.from(table).select('*').order(key).range(from, from + 999);
        expect(error).toBeNull(); rows.push(...data!);
        if (data!.length < 1000) return rows;
      }
    };
    for (const [table, count] of [['bts_research_brokers_staging', 1013], ['bts_research_prop_firms_staging', 414], ['bts_research_tools_staging', 433]] as const) {
      const rows = await all(table, 'entity_id');
      expect(rows.length).toBe(count);
      if (table.includes('brokers')) expect(rows.every((row) => Array.isArray(row.regulatory_licences_json))).toBe(true);
    }
    const scores = await all('bts_scores', 'entity_id');
    const entities = await all('verified_entities', 'id');
    expect(scores).toHaveLength(1860);
    const byId = new Map(scores.map((score) => [score.entity_id, score]));
    let gated = 0;
    for (const entity of entities) {
      if (entity.entity_type === 'guru') continue;
      const score = byId.get(entity.bts_entity_id);
      const output = toPublicEntity({ ...entity, bts: score });
      if (!score || !output) continue;
      if (btsVerificationGate(score.operating_status as string, score.research_status as string)) {
        gated++;
        expect(output.score).toBeNull();
        expect(['Verified', 'Record reviewed']).not.toContain(output.verdict);
      }
      expect(JSON.stringify(output)).not.toContain('research_notes');
    }
    expect(gated).toBeGreaterThan(0);
    const sources = scores.filter((score) => ((score.details as { source_evidence?: unknown[] })?.source_evidence?.length ?? 0) > 0);
    expect(sources).toHaveLength(1849);
    const backupDir = process.env.BTS_QA_BACKUP_DIR;
    if (backupDir) {
      const original = JSON.parse(readFileSync(`${backupDir}/bts_scores.json`, 'utf8')) as Array<Record<string, unknown>>;
      for (const before of original) for (const field of ['global_score', 'raw_score_before_cap', 'verdict', 'evidence_confidence', 'cap_applied', 'score_version']) expect(byId.get(before.entity_id)?.[field]).toEqual(before[field]);
      const previousEntities = JSON.parse(readFileSync(`${backupDir}/verified_entities.json`, 'utf8')) as Array<Record<string, unknown>>;
      expect(entities.filter((row) => row.entity_type === 'guru')).toEqual(previousEntities.filter((row) => row.entity_type === 'guru'));
    }
    console.info(JSON.stringify({ checkedScores: scores.length, protectedFirmRecords: gated, recordsWithHistoricalSources: sources.length, ttsUnchanged: Boolean(backupDir) }));
  }, 120_000);
});
