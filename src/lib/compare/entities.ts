import { unstable_cache } from "next/cache";

import { resolveGuruTier, type GuruTier } from "@/lib/ask/gurus";
import { PILLARS, SCORELESS, gatedVerdict, parseLicences, type BtsRecord, type BtsVerdict } from "@/lib/compare/bts";
import { findRegulator, regulatorForEngineCode } from "@/lib/compare/regulators";
import { getOfficialScores, type OfficialScore } from "@/lib/compare/bts-l2";
import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { btsVerificationGate, readBtsResearch } from "@/lib/compare/bts-research";
import { selectAll } from "@/lib/supabase/select-all";

/**
 * Public view of the `verified_entities` table ("BTS") for the Verify register pages.
 *
 * SECURITY: the select list below is an explicit allowlist. `notes`, `founder_notes`,
 * `internal_notes`, `card_facts`, `prop_terms`, `guru_profile`, `aliases` and every other
 * column are never read. Broker and prop-firm verdicts and scores come only from the BTS engine
 * (`bts_scores`, joined via `bts_entity_id`); the old score columns are not read at all.
 * Some allowlisted columns are inputs to the guru verdict only and never copied into `PublicEntity`:
 *   - gurus: `guru_tier`, `founder_tier_override`, `regulator_flag_source`, `verified_track_record`,
 *     `research_status`, `identity_confirmed` — all fed through `resolveGuruTier`.
 *
 * The ONLY guru fields exposed on `PublicEntity` are the resolved verdict, the citation URL
 * (ONLY when the resolved verdict is "Caution"), the bio summary, and the publishable flag
 * (used by `loadEntities` to filter the register — never rendered).
 */
export const PUBLIC_ENTITY_COLUMNS = [
  "slug",
  "name",
  "entity_type",
  "fca_warning",
  "year_founded",
  "updated_at",
  // BTS engine output (brokers and prop firms):
  "bts:bts_scores(entity_id, operating_status, research_status, global_score, verdict, verdict_reason, cap_applied, evidence_confidence, pillars, details, research_date)",
  "research_status",
  // guru inputs (fed through resolveGuruTier; never exposed raw):
  "guru_tier",
  "founder_tier_override",
  "regulator_flag_source",
  "verified_track_record",
  "identity_confirmed",
  // guru display:
  "bio_summary",
].join(", ");

export type RegulatorRef = { code: string; country: string | null; slug: string | null };

export type PublicEntityType = "broker" | "propfirm" | "guru";

export type GuruVerdict = GuruTier;
/** Broker and prop-firm verdicts (BTS engine) plus the guru-only "Unverified". */
export const VERDICTS = ["Strong", "Generally positive", "Verified", "Record reviewed", "Caution", "High risk", "Insufficient data", "Under review", "Not active", "Not available", "Unverified"] as const;
export type Verdict = BtsVerdict | GuruVerdict;

export type PublicEntity = {
  slug: string;
  name: string;
  type: PublicEntityType;
  /** Global verdict from the BTS engine (brokers/prop firms) or the guru resolver. Country views override it per visitor. */
  verdict: Verdict;
  /** Global BTS score 0–100, or null (Under review, Not active, people). */
  score: number | null;
  /** BTS engine detail behind the verdict; null for people and for firms the engine has not scored. */
  bts: BtsRecord | null;
  fcaRegistered: boolean;
  fcaReference: string | null;
  fcaWarning: boolean;
  /** Regulators with an active licence verified by the engine, e.g. ["FCA", "CySEC"]. */
  regulators: string[];
  /** Same regulators with country and the hub slug (null when we have no reference entry). */
  regulatorDetails: RegulatorRef[];
  yearFounded: number | null;
  /** Engine verdict "Not active": inactive, redirected or merged. */
  closed: boolean;
  /** Guru only: identity confirmed. */
  reviewed: boolean;
  /** When the record was last checked: the official check's date, the BTS research date, else the row's last update. */
  updatedAt: string | null;
  /**
   * Where the score comes from: "official" = a published independent check (shown the same in Ask),
   * "baseline" = the Layer 1 engine score while verification is pending. Null when no score is shown.
   */
  scoreBasis?: "official" | "baseline" | null;
  /**
   * Guru only: cleared for public display (identity + research gate). Used by `loadEntities`
   * to filter the register before caching. NEVER render this field — it is a loader guard,
   * not a UI signal.
   */
  publishable?: boolean;
  /**
   * Guru only: citation URL for a "Caution" verdict (null for every other tier). The resolver
   * downgrades Caution → Unverified when the URL is missing or malformed, so this is only set
   * when the Caution is defensible.
   */
  citationUrl?: string | null;
  /** Guru only: short public bio paragraph, if curated. */
  bioSummary?: string | null;
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Placeholder tokens that mean "no value" in the source data (e.g. a literal "NULL" string). */
const isSentinel = (s: string) => /^(none|null|n\/?a|tbd|unknown|-|–|—)$/i.test(s.trim());
/** The free-text regulator column carries at least one regulator (not empty, a placeholder or "NONE …"). */
const hasRegulators = (listed: string | null): listed is string => {
  if (!listed) return false;
  return !isSentinel(listed) && !/^none\b/i.test(listed.trim());
};

/** "FCA (United Kingdom), CySEC (Cyprus)" -> ["FCA", "CySEC"]. "NONE ..."/"NULL" -> []. */
export function parseRegulators(listed: string | null): string[] {
  if (!hasRegulators(listed)) return [];
  const out = new Set<string>();
  // Split on commas that are not inside parentheses.
  for (const part of listed.split(/,(?![^(]*\))/)) {
    const code = part.replace(/\(.*?\)/g, "").trim();
    if (code && code.length <= 24 && !isSentinel(code)) out.add(code);
  }
  return [...out];
}

/** "FCA (United Kingdom), FSC (Mauritius)" -> code, country and hub slug per regulator. */
export function parseRegulatorRefs(listed: string | null, fcaRegistered = false): RegulatorRef[] {
  const out: RegulatorRef[] = [];
  if (hasRegulators(listed)) {
    for (const part of listed.split(/,(?![^(]*\))/)) {
      const code = part.replace(/\(.*?\)/g, "").trim();
      const country = part.match(/\((.*?)\)/)?.[1]?.trim() || null;
      if (!code || code.length > 24 || isSentinel(code) || out.some((r) => r.code === code && r.country === country)) continue;
      out.push({ code, country, slug: findRegulator(code, country)?.slug ?? null });
    }
  }
  if (fcaRegistered && !out.some((r) => r.code === "FCA")) out.unshift({ code: "FCA", country: "United Kingdom", slug: "fca" });
  return out;
}

/** Maps a raw row to the public shape. Copies only allowlisted fields; anything else is dropped. */
export function toPublicEntity(row: Record<string, unknown>): PublicEntity | null {
  const slug = str(row.slug);
  const name = str(row.name);
  const type = row.entity_type;
  if (!slug || !name || (type !== "broker" && type !== "propfirm" && type !== "guru")) return null;

  const base = {
    slug,
    name,
    type,
    fcaWarning: Boolean(row.fca_warning),
    yearFounded: num(row.year_founded),
    updatedAt: str(row.updated_at),
  } as const;

  if (type === "guru") {
    // People get no numeric score and no regulator/FCA fields. The resolver owns the tier
    // (Caution requires a cited URL; Verified requires a confirmed track record), so the
    // output here is the single source of truth for display.
    const resolution = resolveGuruTier({
      tier: str(row.guru_tier),
      founderTierOverride: str(row.founder_tier_override),
      regulatorFlagSource: str(row.regulator_flag_source),
      verifiedTrackRecord: str(row.verified_track_record),
      researchStatus: str(row.research_status),
      identityConfirmed: Boolean(row.identity_confirmed),
    });
    return {
      ...base,
      // Gurus override the broker/propfirm regulator fields: a person is not regulated.
      regulators: [],
      regulatorDetails: [],
      fcaRegistered: false,
      fcaReference: null,
      fcaWarning: false,
      verdict: resolution.tier,
      score: null,
      bts: null,
      closed: false,
      reviewed: Boolean(row.identity_confirmed),
      publishable: resolution.publishable,
      citationUrl: resolution.tier === "Caution" ? str(row.regulator_flag_source) : null,
      bioSummary: str(row.bio_summary),
    };
  }

  // Brokers and prop firms: the engine row is the only source of verdict and score.
  const raw = row.bts && typeof row.bts === "object" ? (row.bts as Record<string, unknown>) : null;
  if (!raw) {
    // Not scored by the engine yet: no verdict claim, no number, no licence claim.
    return { ...base, regulators: [], regulatorDetails: [], fcaRegistered: false, fcaReference: null, verdict: "Under review", score: null, bts: null, closed: false, reviewed: false };
  }
  const gate = btsVerificationGate(str(raw.operating_status), str(raw.research_status));
  const verdict = gatedVerdict(gate, str(raw.verdict), type);
  const details = (raw.details ?? {}) as Record<string, unknown>;
  const pillars = (raw.pillars ?? {}) as Record<string, unknown>;
  const research = readBtsResearch(details);
  const licences = parseLicences(str(details.active_verified_licences));
  const regulatorDetails: RegulatorRef[] = [];
  for (const l of licences) {
    const ref = regulatorForEngineCode(l.code);
    if (!regulatorDetails.some((r) => r.code === ref.code && r.country === ref.country)) regulatorDetails.push(ref);
  }
  const fca = licences.find((l) => l.code === "FCA");
  return {
    ...base,
    regulators: [...new Set(regulatorDetails.map((r) => r.code))],
    regulatorDetails,
    fcaRegistered: Boolean(fca),
    fcaReference: fca?.number ?? null,
    verdict,
    score: gate || SCORELESS.has(verdict) ? null : num(raw.global_score),
    bts: {
      entityId: String(raw.entity_id),
      research,
      confidence: num(raw.evidence_confidence),
      coverage: num(details.pillar_coverage_pct),
      reason: str(raw.verdict_reason),
      cap: str(raw.cap_applied),
      pillars: PILLARS[type].map(([key, label, max]) => ({ label, max, value: str(pillars[key]) ?? "not checked" })),
      cloneAlert: str(details.clone_alert) === "yes" || Boolean(research?.cloneNoticeSource),
      researchDate: str(raw.research_date),
      licences,
    },
    closed: verdict === "Not active",
    reviewed: false,
    updatedAt: str(raw.research_date) ?? base.updatedAt,
  };
}

/** Fewer records than this from Supabase almost certainly means a broken query or empty table, not real data. */
export const MIN_EXPECTED_ENTITIES: Record<PublicEntityType, number> = { broker: 100, propfirm: 20, guru: 3 };

export async function loadEntities(type: PublicEntityType): Promise<PublicEntity[]> {
  const client = getSupabaseAdminClient();
  if (!client) {
    logger.warn("Compare register unavailable: Supabase admin is not configured.", { type });
    return [];
  }
  // Throw rather than return [] so a failed read is never cached for an hour as "0 brokers"
  // and detail pages answer 500 (retry) instead of 404 (gone) to search engines.
  const data = await selectAll((from, to) =>
    client.from("verified_entities").select(PUBLIC_ENTITY_COLUMNS).eq("entity_type", type).order("name").order("slug").range(from, to),
  ).catch((error: Error) => {
    throw new Error(`Compare register read failed for ${type}: ${error.message}`);
  });
  const mapped = (data as unknown as Record<string, unknown>[])
    .map(toPublicEntity)
    .filter((e): e is PublicEntity => e !== null);
  // Gurus: only publishable (identity-confirmed + research-complete) rows reach the register.
  // Unpublishable rows must never be listed or linked — this is a defamation gate, not a
  // UI preference, and matches the Ask lookup filter in src/lib/ask/entities.ts.
  const entities = type === "guru" ? mapped.filter((e) => e.publishable) : mapped;
  if (entities.length < MIN_EXPECTED_ENTITIES[type]) {
    logger.error("Compare register returned far fewer records than expected.", { type, count: entities.length });
  }
  return entities;
}

/**
 * The register-wide cache entry: the long research texts and source lists are dropped so 800+
 * records serialize well under Next's 2MB `unstable_cache` limit. At 2.6MB the broker register
 * silently failed to cache ("items over 2MB can not be cached", 9 Nov 2026 build log), so every
 * request and every prerender re-ran the full Supabase read until Postgres cancelled statements.
 * List surfaces only read website/legalEntity (dedupe), operatingStatus and cloneNoticeSource;
 * the record page loads the full row per slug via `getPublicEntityRecord`.
 */
export function slimEntity(e: PublicEntity): PublicEntity {
  if (!e.bts?.research) return e;
  return {
    ...e,
    bts: {
      ...e.bts,
      research: { ...e.bts.research, licences: [], sources: [], actions: null, payoutTerms: null, tradingRules: null, disputes: null, auditIssues: [] },
    },
  };
}

const loadSlimEntities = async (type: PublicEntityType) => (await loadEntities(type)).map(slimEntity);

/** All public entities of a type, cached for an hour so filter/search requests don't hit the DB. */
const getEngineEntities = unstable_cache(loadSlimEntities, ["public-entities-v8-slim"], { revalidate: 3600, tags: ["bts"] });

// One register read per process at a time: concurrent renders (a crawl, or the production
// build's prerender workers) share the same in-flight promise instead of each querying Supabase.
const inFlightLists = new Map<PublicEntityType, Promise<PublicEntity[]>>();
function dedupedEngineEntities(type: PublicEntityType): Promise<PublicEntity[]> {
  let run = inFlightLists.get(type);
  if (!run) {
    run = getEngineEntities(type).finally(() => inFlightLists.delete(type));
    inFlightLists.set(type, run);
  }
  return run;
}

/**
 * The register as the website shows it: each firm's official (published, global) score replaces its
 * Layer 1 baseline, so lists, records and Ask agree. Firms without one keep the baseline, marked as such.
 * Gates the engine set (Under review, Not active) still win: those firms show no score at all.
 */
export function withOfficialScores(entities: PublicEntity[], official: Record<string, OfficialScore>): PublicEntity[] {
  return entities.map((e) => {
    if (!e.bts || e.score === null) return e;
    const o = official[`${e.bts.entityId}|XX`];
    if (!o) return { ...e, scoreBasis: "baseline" };
    // A disputed check is waiting for a person: no score anywhere until it is decided.
    if (o.score === null) return { ...e, score: null, verdict: "Under review", scoreBasis: null, updatedAt: o.checkedAt };
    return { ...e, score: o.score, verdict: o.verdict, scoreBasis: "official", updatedAt: o.checkedAt };
  });
}

export async function getPublicEntities(type: PublicEntityType): Promise<PublicEntity[]> {
  const entities = await dedupedEngineEntities(type);
  if (type === "guru") return entities;
  return withOfficialScores(entities, await getOfficialScores().catch(() => ({})));
}

/** Slim view of one entity (no research texts/sources): enough for metadata, lists and vs pages. */
export async function getPublicEntity(type: PublicEntityType, slug: string) {
  return (await getPublicEntities(type)).find((e) => e.slug === slug) ?? null;
}

async function loadEntityRecord(type: PublicEntityType, slug: string): Promise<PublicEntity | null> {
  const client = getSupabaseAdminClient();
  if (!client) {
    logger.warn("Compare record unavailable: Supabase admin is not configured.", { type, slug });
    return null;
  }
  // Same throw-over-[] contract as loadEntities: a failed read must 500 (retry), never 404 or cache as missing.
  const { data, error } = await client.from("verified_entities").select(PUBLIC_ENTITY_COLUMNS).eq("entity_type", type).eq("slug", slug).limit(1).maybeSingle();
  if (error) throw new Error(`Compare record read failed for ${type}/${slug}: ${error.message}`);
  const entity = data ? toPublicEntity(data as unknown as Record<string, unknown>) : null;
  // Defamation gate: unpublishable gurus never render, matching the loadEntities register filter.
  if (!entity || (type === "guru" && !entity.publishable)) return null;
  return entity;
}

// Per-slug cache entries are a few KB each, so unlike the register-wide entry they always fit the 2MB limit.
const getEngineEntityRecord = unstable_cache(loadEntityRecord, ["public-entity-record-v1"], { revalidate: 3600, tags: ["bts"] });

/** One entity with the full research detail (actions, sources, terms), for its record page. */
export async function getPublicEntityRecord(type: PublicEntityType, slug: string): Promise<PublicEntity | null> {
  const entity = await getEngineEntityRecord(type, slug);
  if (!entity) return null;
  if (type === "guru") return entity;
  return withOfficialScores([entity], await getOfficialScores().catch(() => ({})))[0] ?? null;
}

/* ─── Filtering (pure) ─── */

export type EntityFilters = { q?: string; verdict?: string; regulator?: string; status?: string; page?: number };
export const PAGE_SIZE = 40;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

export function filterEntities(entities: PublicEntity[], f: EntityFilters): PublicEntity[] {
  const q = f.q ? norm(f.q) : "";
  return entities.filter((e) => {
    if (q && !norm(e.name).includes(q)) return false;
    if (f.verdict && e.verdict !== f.verdict) return false;
    if (f.regulator && !e.regulators.includes(f.regulator)) return false;
    if (f.status === "closed" && !e.closed) return false;
    if (f.status === "operating" && e.closed) return false;
    return true;
  });
}

/** Regulators present in the data, most common first (for the filter dropdown). */
export function topRegulators(entities: PublicEntity[], limit = 12): string[] {
  const counts = new Map<string, number>();
  for (const e of entities) for (const r of e.regulators) counts.set(r, (counts.get(r) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([r]) => r);
}

// Lives in the client-safe module so client components can colour verdicts without importing DB code.
export { verdictTone } from "@/lib/compare/bts";
