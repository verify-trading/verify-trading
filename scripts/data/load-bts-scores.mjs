// Loads the BTS scoring engine output into Supabase (bts_scores + bts_country_fit) and links each
// verified_entities row to its engine row (verified_entities.bts_entity_id).
//
//   node --env-file=.env.local scripts/data/load-bts-scores.mjs <csv dir> [--research-date=YYYY-MM-DD] [--create-pages] [--dry-run]
//
// --create-pages adds a site record (verified_entities row) for every engine broker and prop firm that
// has none, so the existing /verify routes, lists and regulator pages show it. Tools get no page.
//
// Re-run after every engine run; rows missing from a new run are deleted. The CSVs are confidential:
// keep them out of git. Needs supabase/migration_36_bts_scores_v2.sql applied first.
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { collapseEntityText, createAliases, parseCsvLine } from "./_shared.mjs";
import { backfillKnowledge } from "./backfill-knowledge.mjs";

const SCORE_FILES = [
  { file: "bts_scores_brokers.csv", kind: "broker" },
  { file: "bts_scores_prop_firms.csv", kind: "propfirm" },
  { file: "bts_scores_tools.csv", kind: "tool" },
];
const COUNTRY_FILE = "bts_country_fit_brokers.csv";

/** Engine columns that get their own column in bts_scores. Pillars go to `pillars`, the rest to `details`. */
const COMMON = [
  "entity_id", "brand_name", "operating_status", "research_status", "global_score", "raw_score_before_cap",
  "evidence_confidence", "verdict", "verdict_reason", "cap_applied", "score_version", "research_date",
];
const INTS = new Set(["global_score", "raw_score_before_cap", "evidence_confidence", "country_score"]);

// Site slugs whose name differs from the engine's brand_name. Checked by hand against both lists.
const SLUG_TO_BRAND = {
  ampfutures: "AMP Futures", // a futures broker; was filed as a prop firm until 2026-11-03
  fxtm: "ForexTime",
  hantecmarkets: "Hantec Financial",
  icmarkets: "IC Markets Global",
  saxobank: "Saxo",
  vantagemarkets: "Vantage",
  hotforex: "HFM",
  iggroup: "IG",
  breakoutprop: "Breakout",
  cmcfunded: "CMC Markets Funded",
  fytfundingyourtrades: "Funding Your Trades",
  lucid: "Lucid Trading",
  nostro: "Nostro Markets",
  pivex: "Pivex Funded",
  rocket21challenge: "Rocket21",
  myfundedfx: "MyFundedFX / Seacrest Funded",
  seacrestfunded: "MyFundedFX / Seacrest Funded",
};

// "Hyperfunded (hyperfunded.pro)" -> "hyperfunded"; the domain in brackets disambiguates, it isn't the name.
const key = (name) => collapseEntityText(name.replace(/\(.*?\)/g, ""));

async function readCsv(file) {
  const [header, ...lines] = (await readFile(file, "utf8")).split(/\r?\n/).filter(Boolean);
  const cols = parseCsvLine(header);
  return lines.map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(cols.map((c, i) => {
      const v = values[i] ?? "";
      return [c, v === "" ? null : INTS.has(c) ? Number.parseInt(v, 10) : v];
    }));
  });
}

function toScoreRow(row, kind, researchDate) {
  const out = { kind, pillars: {}, details: {}, research_date: researchDate };
  for (const [c, v] of Object.entries(row)) {
    if (COMMON.includes(c)) out[c] = v;
    else if (c.startsWith("pillar_") && c !== "pillar_coverage_pct") out.pillars[c.slice("pillar_".length)] = v;
    else if (v !== null) out.details[c] = v;
  }
  out.research_date = row.research_date ?? researchDate;
  return out;
}

async function inBatches(rows, size, fn) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

async function selectAll(supabase, table, columns) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

/** Site records for engine firms with no page. Name drops the "(domain)" suffix unless that would clash. */
function pagesForUnlinked(scores, links, entities) {
  const linked = new Set(links.map((l) => l.id).filter(Boolean));
  const taken = new Set(entities.map((e) => e.slug));
  const unlinked = scores.filter((s) => (s.kind === "broker" || s.kind === "propfirm") && !linked.has(s.entity_id));
  const baseCount = new Map();
  for (const s of unlinked) baseCount.set(key(s.brand_name), (baseCount.get(key(s.brand_name)) ?? 0) + 1);
  const pages = [];
  for (const s of unlinked) {
    const short = s.brand_name.replace(/\s*\(.*?\)\s*/g, " ").trim();
    let name = baseCount.get(key(s.brand_name)) > 1 || taken.has(collapseEntityText(short)) ? s.brand_name : short;
    let slug = collapseEntityText(name);
    if (taken.has(slug)) {
      name = s.brand_name;
      // Same brand as both a broker and a prop firm (e.g. TenTrade): the second kind gets a suffixed slug.
      slug = taken.has(collapseEntityText(name)) ? `${collapseEntityText(name)}-${s.kind}` : collapseEntityText(name);
    }
    if (!slug || taken.has(slug)) {
      console.log(`  skipped (slug clash): ${s.brand_name}`);
      continue;
    }
    taken.add(slug);
    pages.push({
      slug,
      name,
      entity_type: s.kind,
      // Legacy column (NOT NULL); the site and Ask read the verdict from the engine row.
      status: s.verdict === "VERIFIED" ? "legitimate" : s.verdict === "HIGH RISK" ? "avoid" : "warning",
      notes: "",
      source: "BTS engine v2",
      aliases: createAliases(name),
      bts_entity_id: s.entity_id,
    });
  }
  return pages;
}

async function main() {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith("--"));
  if (!dir) throw new Error("Usage: load-bts-scores.mjs <csv dir> [--research-date=YYYY-MM-DD] [--dry-run]");
  const dryRun = args.includes("--dry-run");
  const summary = await readFile(path.join(dir, "bts_scoring_summary.txt"), "utf8").catch(() => "");
  const researchDate = args.find((a) => a.startsWith("--research-date="))?.split("=")[1] ?? summary.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;

  const scores = [];
  for (const { file, kind } of SCORE_FILES) {
    const rows = (await readCsv(path.join(dir, file))).map((r) => toScoreRow(r, kind, researchDate));
    console.log(`${file}: ${rows.length} rows`);
    scores.push(...rows);
  }
  const countryRows = (await readCsv(path.join(dir, COUNTRY_FILE))).map((r) => {
    delete r.brand_name; // already on bts_scores
    return r;
  });
  console.log(`${COUNTRY_FILE}: ${countryRows.length} rows`);

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Link site records to engine rows: slug first (stable), then aliases, then display name (some names are wrong,
  // e.g. the "hyperfunded" row is named "Hyper Funding").
  const entities = await selectAll(supabase, "verified_entities", "slug, name, entity_type, aliases");
  const links = [];
  for (const kind of ["broker", "propfirm"]) {
    const byBrand = new Map(scores.filter((s) => s.kind === kind).map((s) => [key(s.brand_name), s.entity_id]));
    const site = entities.filter((e) => e.entity_type === kind);
    const matched = site.map((e) => ({
      slug: e.slug,
      id: [SLUG_TO_BRAND[e.slug], e.slug, ...(e.aliases ?? []), e.name].filter(Boolean).map((c) => byBrand.get(key(c))).find(Boolean) ?? null,
    }));
    links.push(...matched);
    const shared = Object.entries(Object.groupBy(matched.filter((m) => m.id), (m) => m.id)).filter(([, ms]) => ms.length > 1);
    if (shared.length) console.log(`  engine rows shared by several site rows: ${shared.map(([id, ms]) => `${id}=${ms.map((m) => m.slug).join("+")}`).join(", ")}`);
    const linked = new Set(matched.map((m) => m.id).filter(Boolean));
    console.log(`${kind}: ${linked.size}/${byBrand.size} engine rows linked to a site page; site rows with no engine row: ${JSON.stringify(matched.filter((m) => !m.id).map((m) => m.slug))}`);
  }
  const newPages = args.includes("--create-pages") ? pagesForUnlinked(scores, links, entities) : [];
  if (newPages.length) {
    console.log(`New site records: ${newPages.length} (${newPages.filter((p) => p.entity_type === "broker").length} brokers), e.g. ${newPages.slice(0, 5).map((p) => `${p.slug}="${p.name}"`).join(", ")}`);
  }
  if (dryRun) return console.log("Dry run: nothing written.");

  // Preserve the recovered research and its audit on subsequent score-only imports.
  const existingResearch = new Map((await selectAll(supabase, "bts_scores", "entity_id, details")).map((row) => [row.entity_id, row.details ?? {}]));
  for (const score of scores) {
    const existing = existingResearch.get(score.entity_id) ?? {};
    for (const field of ["research_input", "research_audit", "source_evidence", "duplicate_candidates"]) {
      if (field in existing) score.details[field] = existing[field];
    }
  }

  await inBatches(scores, 500, async (batch) => {
    const { error } = await supabase.from("bts_scores").upsert(batch, { onConflict: "entity_id" });
    if (error) throw new Error(`bts_scores: ${error.message}`);
  });
  await inBatches(countryRows, 1000, async (batch) => {
    const { error } = await supabase.from("bts_country_fit").upsert(batch, { onConflict: "country,entity_id" });
    if (error) throw new Error(`bts_country_fit: ${error.message}`);
  });

  await inBatches(newPages, 200, async (batch) => {
    const { error } = await supabase.from("verified_entities").insert(batch);
    if (error) throw new Error(`create pages: ${error.message}`);
  });

  // ponytail: one PATCH per site row (~870), 20 at a time with retries; move to an RPC if it gets slow.
  const link = async ({ slug, id }, attempt = 1) => {
    try {
      const { error } = await supabase.from("verified_entities").update({ bts_entity_id: id }).eq("slug", slug);
      if (error) throw new Error(error.message);
    } catch (error) {
      if (attempt >= 3) throw new Error(`link ${slug}: ${error.message}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      await link({ slug, id }, attempt + 1);
    }
  };
  await inBatches(links, 20, (batch) => Promise.all(batch.map((l) => link(l))));

  // Drop firms the new run no longer has (country rows cascade, site links go null).
  const keep = new Set(scores.map((s) => s.entity_id));
  const stale = (await selectAll(supabase, "bts_scores", "entity_id")).map((r) => r.entity_id).filter((id) => !keep.has(id));
  if (stale.length) {
    const { error } = await supabase.from("bts_scores").delete().in("entity_id", stale);
    if (error) throw new Error(`stale delete: ${error.message}`);
    console.log(`Removed ${stale.length} firms no longer in the run.`);
  }

  // Cached Ask answers quote the old verdicts.
  const { error: cacheError } = await supabase.from("ask_response_cache").delete().neq("cache_key", "");
  if (cacheError) throw new Error(`ask_response_cache: ${cacheError.message}`);
  // Ask's retrieval index carries each firm's verdict text: rebuild it from the new run.
  await backfillKnowledge(supabase);
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
