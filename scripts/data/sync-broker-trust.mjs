// Upserts the BTS master CSV (brokers) into public.verified_entities. Existing
// live FCA results and cached scores on matched rows are preserved, not wiped;
// trust_score is left null and computed on read by src/lib/ask/bts.ts.
//
//   node scripts/data/sync-broker-trust.mjs [path/to/BTS_MASTER.csv]
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

/** "=""1:500""" / "=1:500" / "1:500" -> "1:500"; blank/N/A -> null. */
function normalizeLeverage(raw) {
  const cleaned = String(raw ?? "").replace(/[="]/g, "").trim();
  if (!cleaned || /^(n\/?a|none|unknown)$/i.test(cleaned)) return null;
  return cleaned;
}

function truthy(value) {
  return /^(yes|true|1)$/i.test(String(value ?? "").trim());
}

/** Map BTS tier + founder status onto the verified_entities status enum. */
function deriveStatus(finalTier, finalStatus) {
  const status = String(finalStatus ?? "").toUpperCase();
  if (status.includes("AVOID")) return "avoid";
  if (status.includes("CAUTION")) return "warning";
  const tier = String(finalTier ?? "").trim();
  if (tier === "Tier 1" || tier === "Tier 2") return "legitimate";
  if (tier === "Tier 3") return "warning";
  return "avoid"; // Unregulated / Avoid / unknown
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
    : path.join(process.cwd(), "BTS_MASTER_FOR_DEV_FIXED.csv");
  const raw = await readFile(filePath, "utf8");
  const [headerLine, ...lines] = raw.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(headerLine);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Existing rows: preserve live FCA results + cached score (don't wipe).
  const { data: existingRows, error: fetchError } = await supabase
    .from("verified_entities")
    .select("slug, notes, fca_registered, fca_reference, fca_warning, trust_score");
  if (fetchError) throw fetchError;
  const existingBySlug = new Map((existingRows ?? []).map((row) => [row.slug, row]));

  const rows = lines.map((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    const name = row.name.trim();
    const slug = collapseEntityText(name);
    const existing = existingBySlug.get(slug);
    const founderNotes = (row.founder_notes ?? "").trim();

    return {
      slug,
      name,
      entity_type: (row.entity_type || "broker").trim(),
      status: deriveStatus(row.FINAL_tier, row.FINAL_status),
      fca_registered: existing ? existing.fca_registered : false,
      fca_reference: existing ? existing.fca_reference : null,
      fca_warning: existing ? existing.fca_warning : false,
      trust_score: existing ? existing.trust_score : null,
      notes: founderNotes || existing?.notes || "",
      source: (row.source_note || "BTS build").trim(),
      aliases: createAliases(name),
      regulators_listed: (row.regulators_listed ?? "").trim() || null,
      leverage: normalizeLeverage(row.leverage),
      final_tier: (row.FINAL_tier ?? "").trim() || null,
      final_status: (row.FINAL_status ?? "").trim() || null,
      founder_verified: truthy(row.founder_verified),
      founder_notes: founderNotes || null,
      verification_method: (row.verification_method ?? "").trim() || null,
    };
  });

  const BATCH = 500;
  let upserted = 0;
  for (let index = 0; index < rows.length; index += BATCH) {
    const batch = rows.slice(index, index + BATCH);
    const { error } = await supabase
      .from("verified_entities")
      .upsert(batch, { onConflict: "slug" });
    if (error) throw error;
    upserted += batch.length;
  }

  const founderLocked = rows.filter((row) => row.founder_verified).length;
  console.log(
    `Upserted ${upserted} brokers (${founderLocked} founder-locked). ` +
      `${existingBySlug.size} pre-existing rows preserved/merged.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
