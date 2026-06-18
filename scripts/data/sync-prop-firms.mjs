// Upserts the TTS prop-firm CSV into public.verified_entities (entity_type =
// 'propfirm'). Stores the inputs (year, status, Trustpilot snapshot, founder
// fields) and the founder's blended AUTO score as the baseline; the displayed
// score is computed on read by src/lib/ask/prop-firms.ts. Upsert only — never
// wipe — so live FCA results and founder overrides on matched rows survive.
//
//   node scripts/data/sync-prop-firms.mjs ["path/to/TTS_PROPFIRMS.csv"]
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.

import { readFile } from "node:fs/promises";
import path from "node:path";

import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (character === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  values.push(current);
  return values.map((value) => value.trim());
}

function normalizeEntityText(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function collapseEntityText(value) {
  return normalizeEntityText(value).replace(/\s+/g, "");
}
function createAliases(name) {
  const base = normalizeEntityText(name);
  const aliases = new Set([base, collapseEntityText(name)]);
  const spacedDigits = base.replace(/([a-z])(\d)/g, "$1 $2").replace(/(\d)([a-z])/g, "$1 $2");
  aliases.add(spacedDigits);
  aliases.add(collapseEntityText(spacedDigits));
  if (base.startsWith("the ")) {
    aliases.add(base.slice(4));
    aliases.add(collapseEntityText(base.slice(4)));
  }
  if (base.endsWith(" group")) {
    aliases.add(base.replace(/ group$/, ""));
  }
  return [...aliases].filter(Boolean);
}

/** "4.4" -> 4.4; "~21,000" -> 21000; blank/N/A -> null. */
function numOrNull(raw) {
  const digits = String(raw ?? "").replace(/[^0-9.]/g, "");
  if (!digits) return null;
  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}

function isClosed(firmStatus) {
  return /closed|defunct|shut down|wound down/i.test(firmStatus ?? "");
}

/** AUTO_label + closure note -> the legitimate/warning/avoid status enum. */
function deriveStatus(autoLabel, firmStatus) {
  if (isClosed(firmStatus)) return "avoid";
  const label = String(autoLabel ?? "").toLowerCase();
  if (label.includes("trusted")) return "legitimate";
  if (label.includes("avoid")) return "avoid";
  return "warning"; // Proceed With Caution / High Risk
}

const TERM_FIELDS = [
  "funding_model",
  "platforms",
  "max_allocation",
  "payout_frequency",
  "profit_split",
  "min_payout_threshold",
];

function buildTerms(row) {
  const terms = {};
  for (const field of TERM_FIELDS) {
    const value = (row[field] ?? "").trim();
    if (value) {
      terms[field] = value;
    }
  }
  return Object.keys(terms).length > 0 ? terms : null;
}

async function main() {
  loadEnvConfig(process.cwd());

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const filePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(process.cwd(), "TTS_PROPFIRMS_SCORED.csv");
  const raw = await readFile(filePath, "utf8");
  const [headerLine, ...lines] = raw.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(headerLine);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Preserve any founder override + live FCA result already stored on a row.
  const { data: existingRows, error: fetchError } = await supabase
    .from("verified_entities")
    .select("slug, founder_override_score, fca_registered, fca_reference, fca_warning");
  if (fetchError) throw fetchError;
  const existingBySlug = new Map((existingRows ?? []).map((row) => [row.slug, row]));

  const rows = lines.map((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    const name = row.name.trim();
    const slug = collapseEntityText(name);
    const existing = existingBySlug.get(slug);
    const founderNotes = (row.FOUNDER_notes ?? "").trim() || null;

    return {
      slug,
      name,
      entity_type: "propfirm",
      status: deriveStatus(row.AUTO_label, row.status),
      trust_score: numOrNull(row.AUTO_overall_score_0_10),
      notes: founderNotes ?? "",
      source: "TTS prop research",
      aliases: createAliases(name),
      founder_notes: founderNotes,
      year_founded: numOrNull(row.year_founded),
      firm_status: (row.status ?? "").trim() || null,
      trustpilot_rating: numOrNull(row.trustpilot_rating),
      trustpilot_count: numOrNull(row.trustpilot_count),
      founder_override_score: existing?.founder_override_score ?? null,
      prop_terms: buildTerms(row),
      fca_registered: existing?.fca_registered ?? false,
      fca_reference: existing?.fca_reference ?? null,
      fca_warning: existing?.fca_warning ?? false,
    };
  });

  const BATCH = 500;
  let upserted = 0;
  for (let index = 0; index < rows.length; index += BATCH) {
    const batch = rows.slice(index, index + BATCH);
    const { error } = await supabase.from("verified_entities").upsert(batch, { onConflict: "slug" });
    if (error) throw error;
    upserted += batch.length;
  }

  const closed = rows.filter((row) => isClosed(row.firm_status)).length;
  console.log(`Upserted ${upserted} prop firms (${closed} closed/defunct).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
