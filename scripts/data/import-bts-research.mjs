// Import an audited manifest. Default: backup + dry run. Never writes TTS or score columns.
import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const option = (key) => args[args.indexOf(key) + 1];
if (!args.includes('--manifest') || !args.includes('--backup-dir')) throw new Error('Use --manifest <file> --backup-dir <private dir> [--apply|--backup-only]');
const manifest = JSON.parse(await readFile(option('--manifest'), 'utf8'));
const backupDir = option('--backup-dir');
await mkdir(backupDir, { recursive: true, mode: 0o700 });
await chmod(backupDir, 0o700);
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function all(table, columns, keys) {
  const rows = [];
  for (let start = 0; ; start += 1000) {
    let query = client.from(table).select(columns);
    for (const key of keys) query = query.order(key);
    const { data, error } = await query.range(start, start + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

const tables = { bts_scores: ['entity_id'], bts_country_fit: ['country', 'entity_id'], verified_entities: ['id'], bts_l2_assessments: ['id'] };
const backup = {};
const backupReport = {};
for (const [table, keys] of Object.entries(tables)) {
  const rows = await all(table, '*', keys);
  backup[table] = rows;
  const content = JSON.stringify(rows);
  await writeFile(path.join(backupDir, `${table}.json`), content, { mode: 0o600, flag: 'wx' });
  backupReport[table] = { rows: rows.length, sha256: createHash('sha256').update(content).digest('hex') };
  console.info(JSON.stringify({ backedUp: table, rows: rows.length }));
}
await writeFile(path.join(backupDir, 'manifest.json'), JSON.stringify({ createdAt: new Date().toISOString(), tables: backupReport }), { mode: 0o600, flag: 'wx' });
if (args.includes('--backup-only')) process.exit(0);

const expected = { broker: 1013, propfirm: 414, tool: 433 };
for (const [kind, count] of Object.entries(expected)) {
  const records = manifest.records.filter((record) => record.kind === kind);
  if (records.length !== count || new Set(records.map((record) => record.staging.entity_id)).size !== count) throw new Error(`${kind}: invalid record count or duplicate IDs`);
  if (records.some((record) => !record.staging.audit.engine_reproduced)) throw new Error(`${kind}: unaudited score`);
}
const scores = new Map(backup.bts_scores.map((row) => [row.entity_id, row]));
for (const record of manifest.records) {
  const score = scores.get(record.staging.entity_id);
  if (!score || score.kind !== record.kind || String(score.global_score ?? '') !== String(record.baseline.global_score ?? '') || score.score_version !== record.baseline.score_version) throw new Error(`Live baseline changed for ${record.staging.entity_id}; audit again before applying`);
}
if (!args.includes('--apply')) {
  console.info(JSON.stringify({ dryRun: true, summary: manifest.summary, duplicateCandidates: manifest.duplicate_candidates.length }));
  process.exit(0);
}

const stageTables = { broker: 'bts_research_brokers_staging', propfirm: 'bts_research_prop_firms_staging', tool: 'bts_research_tools_staging' };
for (const [kind, table] of Object.entries(stageTables)) {
  const records = manifest.records.filter((record) => record.kind === kind).map((record) => record.staging);
  for (let start = 0; start < records.length; start += 100) {
    const { error } = await client.from(table).upsert(records.slice(start, start + 100), { onConflict: 'entity_id' });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  const { count, error } = await client.from(table).select('entity_id', { count: 'exact', head: true });
  if (error || count !== expected[kind]) throw new Error(`${table}: expected ${expected[kind]}, got ${count}`);
  console.info(JSON.stringify({ staged: table, rows: count }));
}

const duplicateCandidates = new Map();
for (const group of manifest.duplicate_candidates) for (const record of group.records) duplicateCandidates.set(record.entity_id, group.records.map((r) => r.entity_id));
const queue = [...manifest.records];
let linked = 0;
async function worker() {
  while (queue.length) {
    const record = queue.shift();
    const score = scores.get(record.staging.entity_id);
    const details = { ...score.details, research_input: record.staging.research, research_audit: record.staging.audit, source_evidence: record.sources, duplicate_candidates: duplicateCandidates.get(score.entity_id) ?? [] };
    const { data, error } = await client.from('bts_scores').update({ details }).eq('entity_id', score.entity_id).eq('score_version', score.score_version).eq('details', JSON.stringify(score.details)).select('entity_id');
    if (error || data?.length !== 1) throw new Error(`${score.entity_id}: update failed or concurrent change; restore/review before retrying: ${error?.message ?? 'row changed'}`);
    linked++;
    if (linked % 200 === 0) console.info(JSON.stringify({ linked }));
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
const final = await all('bts_scores', 'entity_id,global_score,raw_score_before_cap,verdict,evidence_confidence,cap_applied,score_version,details', ['entity_id']);
for (const score of final) {
  const before = scores.get(score.entity_id);
  for (const field of ['global_score', 'raw_score_before_cap', 'verdict', 'evidence_confidence', 'cap_applied', 'score_version']) if (score[field] !== before[field]) throw new Error(`${score.entity_id}: score field changed unexpectedly`);
}
const gurusBefore = backup.verified_entities.filter((row) => row.entity_type === 'guru');
const gurusAfter = (await all('verified_entities', '*', ['id'])).filter((row) => row.entity_type === 'guru');
if (JSON.stringify(gurusBefore) !== JSON.stringify(gurusAfter)) throw new Error('TTS changed concurrently; review the backup');
console.info(JSON.stringify({ restoredResearch: linked, scoreColumnsUnchanged: true, ttsUnchanged: true, recordsWithHistoricalSources: final.filter((r) => r.details.source_evidence?.length).length }));
