// Upserts the TTS gurus CSV into public.verified_entities (entity_type = 'guru').
// Stores inputs; the public tier is resolved on read by src/lib/ask/gurus.ts.
// Upsert only — never wipe — so founder reviews, overrides, and FCA-job results
// on matched rows survive a re-import.
//
// Safety enforced here (defense in depth with the DB CHECK + the read gate):
//   - A stored Caution without a valid citation URL is downgraded to Unverified,
//     so it can neither violate the constraint nor publish an unsupported negative.
//   - founder_reviewed defaults from research_status; nothing thin goes public.
//   - identity-ambiguity names are held (identity_confirmed = false) until confirmed.
//
//   node scripts/data/sync-gurus.mjs ["path/to/TTS_GURUS_WORKSHEET.csv"]
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.

import { readFile } from "node:fs/promises";
import path from "node:path";

import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { backfillKnowledge } from "./backfill-knowledge.mjs";
import {
  collapseEntityText,
  createAliases,
  isValidCitation,
  parseCsvLine,
} from "./_shared.mjs";

const { loadEnvConfig } = nextEnv;

function normalizeTier(value) {
  switch (String(value ?? "").trim().toLowerCase()) {
    case "verified":
      return "Verified";
    case "caution":
      return "Caution";
    default:
      return "Unverified";
  }
}

/** Research-complete enough to publish once the founder has confirmed the row. */
const REVIEWED_STATUSES = new Set([
  "researched",
  "researched (fca-confirmed)",
  "founder-confirmed (conduct)",
]);

/** Same-name traps that must not publish until identity is confirmed (spec §8). */
const IDENTITY_HOLD = new Set(["umar ashraf", "arthur hayes signals", "reuben singh"]);

const PROFILE_FIELDS = [
  "primary_handle",
  "platform",
  "audience_size",
  "region",
  "years_active",
  "what_they_sell",
  "affiliate_broker_pushed",
  "outreach_candidate",
];

function buildProfile(row) {
  const profile = {};
  for (const field of PROFILE_FIELDS) {
    const value = (row[field] ?? "").trim();
    if (value) {
      profile[field] = value;
    }
  }
  return Object.keys(profile).length > 0 ? profile : null;
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
    : path.join(process.cwd(), "TTS_GURUS_WORKSHEET.csv");
  const raw = await readFile(filePath, "utf8");
  const [headerLine, ...lines] = raw.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(headerLine);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Preserve founder reviews / overrides already set on a row.
  const { data: existingRows, error: fetchError } = await supabase
    .from("verified_entities")
    .select("slug, founder_reviewed, identity_confirmed, founder_tier_override");
  if (fetchError) throw fetchError;
  const existingBySlug = new Map((existingRows ?? []).map((row) => [row.slug, row]));

  let downgraded = 0;
  const rows = lines.map((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    const name = row.name.trim();
    const slug = collapseEntityText(name);
    const existing = existingBySlug.get(slug);

    const source = (row.regulator_flag_source ?? "").trim() || null;
    const cited = isValidCitation(source);

    // The Caution gate at write time: a Caution claim without a real citation is
    // stored as Unverified (also keeps the DB CHECK constraint satisfiable).
    let tier = normalizeTier(row.TIER);
    if (tier === "Caution" && !cited) {
      tier = "Unverified";
      downgraded += 1;
    }
    let override = normalizeTierOrNull(row.FOUNDER_tier_override);
    if (override === "Caution" && !cited) {
      override = null;
    }

    const researchStatus = (row.research_status ?? "").trim() || null;
    // Both publish gates are monotonic in their SAFE direction, because a column
    // default written by the migration is indistinguishable from a deliberate
    // founder decision — so `??` would let a stale default override the truth.
    //   - founder_reviewed: promote-only. Research completion (or a prior true)
    //     makes a row reviewed; a default-false must never block a researched row.
    const founderReviewed =
      Boolean(existing?.founder_reviewed) ||
      REVIEWED_STATUSES.has((researchStatus ?? "").toLowerCase());
    //   - identity_confirmed: hold wins. A flagged same-name trap stays unpublished
    //     until its name is cleared from IDENTITY_HOLD (a deliberate code change),
    //     regardless of any prior/default true on the row.
    const identityConfirmed = IDENTITY_HOLD.has(name.toLowerCase())
      ? false
      : (existing?.identity_confirmed ?? true);

    return {
      slug,
      name,
      entity_type: "guru",
      status: tier === "Caution" ? "warning" : "legitimate",
      trust_score: null,
      notes: "",
      source: "TTS guru research",
      aliases: createAliases(name, row.primary_handle),
      guru_tier: tier,
      founder_tier_override: existing?.founder_tier_override ?? override,
      regulator_flag: (row.regulator_flag ?? "").trim() || null,
      regulator_flag_source: source,
      verified_track_record: (row.verified_track_record ?? "").trim() || null,
      research_status: researchStatus,
      founder_reviewed: founderReviewed,
      identity_confirmed: identityConfirmed,
      bio_summary: (row.bio_summary ?? "").trim() || null,
      internal_notes: (row.FOUNDER_notes ?? "").trim() || null,
      guru_profile: buildProfile(row),
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

  const cautions = rows.filter((row) => row.guru_tier === "Caution").length;
  const publishable = rows.filter((row) => row.founder_reviewed && row.identity_confirmed).length;
  console.log(
    `Upserted ${upserted} gurus (${cautions} cited Caution, ${downgraded} unsupported Caution -> Unverified, ` +
      `${publishable} publishable after review).`,
  );

  // Keep the retrieval index in sync — never leave it stale after a load.
  await backfillKnowledge(supabase);
}

function normalizeTierOrNull(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? normalizeTier(trimmed) : null;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
