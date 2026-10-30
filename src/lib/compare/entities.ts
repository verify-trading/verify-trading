import { unstable_cache } from "next/cache";

import { computeBrokerTrustScore } from "@/lib/ask/bts";
import { computePropFirmScore, isClosedFirm } from "@/lib/ask/prop-firms";
import { resolveGuruTier, type GuruTier } from "@/lib/ask/gurus";
import { findRegulator } from "@/lib/compare/regulators";
import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Public view of the `verified_entities` table ("BTS") for the Verify register pages.
 *
 * SECURITY: the select list below is an explicit allowlist. `notes`, `founder_notes`,
 * `internal_notes`, `card_facts`, `prop_terms`, `guru_profile`, `aliases` and every other
 * column are never read. Some allowlisted columns are inputs to the score or verdict only and
 * never copied into `PublicEntity`:
 *   - brokers: `final_status`, `verification_method`, `founder_verified`, `leverage`, `trust_score`, `final_tier`, `status`
 *   - prop firms: `firm_status`, `trust_score`
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
  "fca_registered",
  "fca_reference",
  "fca_warning",
  "regulators_listed",
  "year_founded",
  "updated_at",
  "status",
  // score inputs only (not exposed):
  "trust_score",
  "final_tier",
  "final_status",
  "founder_verified",
  "verification_method",
  "leverage",
  "firm_status",
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
export const VERDICTS = [
  "Strongly Trusted",
  "Trusted",
  "Proceed With Caution",
  "High Risk",
  "Avoid",
  "Not yet rated",
  "Verified",
  "Unverified",
  "Caution",
] as const;
export type Verdict = (typeof VERDICTS)[number];

export type PublicEntity = {
  slug: string;
  name: string;
  type: PublicEntityType;
  verdict: Verdict;
  /** Trust score out of 10, or null when unrated / provisional / a person. */
  score: number | null;
  /** Broker with no regulatory basis or live register check yet. */
  provisional: boolean;
  fcaRegistered: boolean;
  fcaReference: string | null;
  fcaWarning: boolean;
  /** Regulator short names parsed from the listed regulators, e.g. ["FCA", "CySEC"]. */
  regulators: string[];
  /** Same regulators with country and the hub slug (null when we have no reference entry). */
  regulatorDetails: RegulatorRef[];
  yearFounded: number | null;
  closed: boolean;
  /** Prop firm retained on discovery but not yet scored. */
  developing: boolean;
  /** True when a person has reviewed and locked the record. */
  reviewed: boolean;
  /** ISO timestamp of the last update to the record. */
  updatedAt: string | null;
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

/** "FCA (United Kingdom), CySEC (Cyprus)" -> ["FCA", "CySEC"]. "NONE ..."/"NULL" -> []. */
export function parseRegulators(listed: string | null): string[] {
  if (!listed || isSentinel(listed) || /^none\b/i.test(listed.trim())) return [];
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
  if (listed && !isSentinel(listed) && !/^none\b/i.test(listed.trim())) {
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

/** A register-confirmed FCA firm lists FCA even when the free-text regulator column is empty. */
const withFca = (list: string[], registered: boolean) => (registered && !list.includes("FCA") ? ["FCA", ...list] : list);

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
    fcaRegistered: Boolean(row.fca_registered),
    fcaReference: str(row.fca_reference),
    fcaWarning: Boolean(row.fca_warning),
    regulators: withFca(parseRegulators(str(row.regulators_listed)), Boolean(row.fca_registered)),
    regulatorDetails: parseRegulatorRefs(str(row.regulators_listed), Boolean(row.fca_registered)),
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
      provisional: false,
      closed: false,
      developing: false,
      reviewed: Boolean(row.identity_confirmed),
      publishable: resolution.publishable,
      citationUrl: resolution.tier === "Caution" ? str(row.regulator_flag_source) : null,
      bioSummary: str(row.bio_summary),
    };
  }

  if (type === "propfirm") {
    const firmStatus = str(row.firm_status);
    const prop = computePropFirmScore({
      firmStatus,
      autoScore: num(row.trust_score),
      founderOverrideScore: null,
    });
    return {
      ...base,
      verdict: prop.band ?? "Not yet rated",
      score: prop.score,
      provisional: false,
      closed: isClosedFirm(firmStatus),
      developing: prop.notRated,
      reviewed: false,
    };
  }

  const founderVerified = Boolean(row.founder_verified);
  const finalTier = str(row.final_tier);
  const computed = finalTier
    ? computeBrokerTrustScore({
        finalTier,
        finalStatus: str(row.final_status),
        founderVerified,
        leverage: str(row.leverage),
        regulatorsListed: str(row.regulators_listed),
        verificationMethod: str(row.verification_method),
      })
    : null;
  const stored = num(row.trust_score);
  const status = row.status === "avoid" ? "Avoid" : row.status === "warning" ? "Proceed With Caution" : "Trusted";
  return {
    ...base,
    verdict: computed ? computed.band : stored === null ? "Not yet rated" : status,
    score: computed ? (computed.provisional ? null : computed.score) : stored,
    provisional: computed?.provisional ?? false,
    closed: false,
    developing: false,
    reviewed: founderVerified,
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
  const { data, error } = await client
    .from("verified_entities")
    .select(PUBLIC_ENTITY_COLUMNS)
    .eq("entity_type", type)
    .order("name")
    .range(0, 4999);
  // Throw rather than return [] so a failed read is never cached for an hour as "0 brokers"
  // and detail pages answer 500 (retry) instead of 404 (gone) to search engines.
  if (error || !data) throw new Error(`Compare register read failed for ${type}: ${error?.message ?? "no data"}`);
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

/** All public entities of a type, cached for an hour so filter/search requests don't hit the DB. */
export const getPublicEntities = unstable_cache(loadEntities, ["public-entities-v3"], { revalidate: 3600 });

export async function getPublicEntity(type: PublicEntityType, slug: string) {
  return (await getPublicEntities(type)).find((e) => e.slug === slug) ?? null;
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
    if (f.status === "developing" && !e.developing) return false;
    if (f.status === "operating" && (e.closed || e.developing)) return false;
    return true;
  });
}

/** Regulators present in the data, most common first (for the filter dropdown). */
export function topRegulators(entities: PublicEntity[], limit = 12): string[] {
  const counts = new Map<string, number>();
  for (const e of entities) for (const r of e.regulators) counts.set(r, (counts.get(r) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([r]) => r);
}

export const verdictTone = (v: Verdict): "green" | "amber" | "coral" | "slate" => {
  if (v === "Strongly Trusted" || v === "Trusted" || v === "Verified") return "green";
  if (v === "Proceed With Caution" || v === "Caution") return "amber";
  if (v === "Not yet rated" || v === "Unverified") return "slate";
  return "coral";
};
