/**
 * BTS scoring engine v2 (bts-score-2.0): shapes and rules for reading its output.
 *
 * The engine runs offline and writes `bts_scores` + `bts_country_fit`; this file only maps those
 * rows for display. It never computes or adjusts a score. Client-safe (no server imports).
 */

export const ENGINE_VERDICTS = {
  VERIFIED: "Verified",
  CAUTION: "Caution",
  "HIGH RISK": "High risk",
  "INSUFFICIENT DATA": "Insufficient data",
  "UNDER REVIEW": "Under review",
  "NOT ACTIVE": "Not active",
  "NOT AVAILABLE IN YOUR COUNTRY": "Not available",
} as const;
/** A prop firm that passes is shown as "Record reviewed": a passing record, not a safety endorsement. */
export type BtsVerdict = (typeof ENGINE_VERDICTS)[keyof typeof ENGINE_VERDICTS] | "Record reviewed" | OfficialVerdict;
/** Verdicts of a published (official) score; Caution and High risk are shared with the engine scale. */
export type OfficialVerdict = "Strong" | "Generally positive" | "Caution" | "High risk";

/** Badge colour for any verdict, including the guru tiers (Verified / Unverified / Caution). */
export const verdictTone = (v: string): "green" | "amber" | "coral" | "slate" => {
  if (v === "Verified" || v === "Strong" || v === "Generally positive") return "green";
  if (v === "Caution") return "amber";
  if (v === "High risk") return "coral";
  return "slate";
};

export function toVerdict(raw: string | null | undefined, kind?: string): BtsVerdict {
  const label = ENGINE_VERDICTS[(raw ?? "").trim().toUpperCase() as keyof typeof ENGINE_VERDICTS] ?? "Under review";
  return label === "Verified" && kind === "propfirm" ? "Record reviewed" : label;
}

/** Research gates override the engine verdict; the gate types come from btsVerificationGate. */
export function gatedVerdict(gate: string | null, rawVerdict: string | null | undefined, kind?: string): BtsVerdict {
  return gate === "needs_review" ? "Under review" : gate === "inactive" ? "Not active" : gate === "unknown" ? "Insufficient data" : toVerdict(rawVerdict, kind);
}

/** Ends the card when there is no official score or live check and the Layer 1 baseline is shown instead. */
export const DATABASE_ONLY = "Independent verification is still pending, so this is our baseline assessment.";

/** Ask card status for an engine verdict or a live-check verdict (Strong / Generally positive / Score unavailable). */
export const cardStatus = (v: string) =>
  v === "Verified" || v === "Record reviewed" || v === "Strong" || v === "Generally positive" ? "LEGITIMATE" : v === "High risk" || v === "Not active" ? "AVOID" : v === "Caution" ? "CAUTION" : "WARNING";
/** Card colour for a status: green, amber for a mid-range Caution, red otherwise. */
export const statusColor = (status: string) => (status === "LEGITIMATE" ? "green" : status === "CAUTION" ? "amber" : "red") as "green" | "amber" | "red";

/** Verdicts that never show a number (the engine leaves the score empty or it isn't meaningful); also left out of every list and ranking. */
export const SCORELESS: ReadonlySet<BtsVerdict> = new Set(["Under review", "Not active", "Not available"]);

/** Pillar order and maximum points, per the approved method. */
export const PILLARS = {
  broker: [
    ["regulation", "Regulation", 40],
    ["client_protection", "Client protection", 20],
    ["conduct", "Regulatory conduct", 25],
    ["track_record", "Track record", 10],
    ["transparency", "Transparency", 5],
  ],
  propfirm: [
    ["identity", "Identity", 20],
    ["transparency", "Transparency", 25],
    ["dispute_record", "Dispute record", 20],
    ["regulatory_conduct", "Regulatory conduct", 25],
    ["rule_disclosure", "Rule disclosure", 10],
  ],
} as const;

export type BtsPillar = { label: string; max: number; value: string };

export type BtsRecord = {
  research?: import("@/lib/compare/bts-research").BtsResearch | null;
  entityId: string;
  confidence: number | null;
  /** Share of researched pillars; separate from source reliability. */
  coverage?: number | null;
  reason: string | null;
  cap: string | null;
  pillars: BtsPillar[];
  cloneAlert: boolean;
  /** Date the research behind this score was checked (ISO date). */
  researchDate: string | null;
  /** Active licences verified on a register: engine code + licence number. */
  licences: Array<{ code: string; number: string | null }>;
};

/** "FCA:195355|CYSEC:388/20 (note)" -> [{ code: "FCA", number: "195355" }, …] */
export function parseLicences(raw: string | null | undefined): BtsRecord["licences"] {
  return (raw ?? "")
    .split("|")
    .map((l) => l.trim().match(/^([A-Z_]+):\s*(.*)$/))
    .flatMap((m) => (m ? [{ code: m[1], number: m[2].replace(/\s*\(.*$/, "").trim() || null }] : []))
    .map((l) => ({ ...l, number: l.number === "n/a" ? null : l.number }));
}

export const pillarDisplay = (p: BtsPillar) => (/not checked/i.test(p.value) ? "Not yet checked" : `${p.value} / ${p.max}`);

/* ─── Country layer ─── */

/**
 * Countries where the full country verdict is live. Elsewhere a "no local licence verified" row
 * falls back to the global rating, because licence data outside these markets is not complete yet
 * (it would show IG as 40 Caution in Germany). Add a market only after its licence-completion pass.
 */
const FULL_COUNTRY_VERDICTS: ReadonlySet<string> = new Set(["GB"]);

/**
 * Countries the engine has rows for (66; XX = unknown). Names are fixed rather than Intl.DisplayNames,
 * which differs between Node and browsers ("Hong Kong SAR China" vs "Hong Kong") and breaks hydration.
 */
const COUNTRY_NAMES: Record<string, string> = { AE: "United Arab Emirates", AR: "Argentina", AT: "Austria", AU: "Australia", BE: "Belgium", BG: "Bulgaria", BH: "Bahrain", BR: "Brazil", CA: "Canada", CH: "Switzerland", CL: "Chile", CN: "China", CO: "Colombia", CY: "Cyprus", CZ: "Czechia", DE: "Germany", DK: "Denmark", EE: "Estonia", EG: "Egypt", ES: "Spain", FI: "Finland", FR: "France", GB: "United Kingdom", GH: "Ghana", GR: "Greece", HK: "Hong Kong", HR: "Croatia", HU: "Hungary", ID: "Indonesia", IE: "Ireland", IL: "Israel", IN: "India", IS: "Iceland", IT: "Italy", JP: "Japan", KE: "Kenya", KR: "South Korea", KW: "Kuwait", LI: "Liechtenstein", LT: "Lithuania", LU: "Luxembourg", LV: "Latvia", MT: "Malta", MX: "Mexico", MY: "Malaysia", NG: "Nigeria", NL: "Netherlands", NO: "Norway", NZ: "New Zealand", PE: "Peru", PH: "Philippines", PL: "Poland", PT: "Portugal", QA: "Qatar", RO: "Romania", SA: "Saudi Arabia", SE: "Sweden", SG: "Singapore", SI: "Slovenia", SK: "Slovakia", TH: "Thailand", TR: "Türkiye", TW: "Taiwan", US: "United States", VN: "Vietnam", ZA: "South Africa" };
export const BTS_COUNTRIES = Object.keys(COUNTRY_NAMES);
const SUPPORTED: ReadonlySet<string> = new Set(BTS_COUNTRIES);

export const COUNTRY_COOKIE = "vt_country"; // the user's choice; wins over the IP guess
export const GEO_COOKIE = "vt_geo"; // IP guess, set by middleware from x-vercel-ip-country

/** Any input -> a supported ISO code, or "XX" (unknown / not covered). */
export const normalizeCountry = (raw: string | null | undefined) => {
  const c = (raw ?? "").trim().toUpperCase();
  return SUPPORTED.has(c) ? c : "XX";
};

export const countryName = (code: string) => (code === "XX" ? "Global" : (COUNTRY_NAMES[code] ?? code));
export const countryFlag = (code: string) =>
  code === "XX" ? "🌐" : String.fromCodePoint(...[...code].map((ch) => 0x1f1a5 + ch.charCodeAt(0)));

export type CountryFitRow = {
  country: string;
  fit: string | null;
  score: number | null;
  verdict: string;
  licences: string | null;
  note: string | null;
};

export type CountryView = {
  country: string;
  verdict: BtsVerdict;
  score: number | null;
  note: string | null;
  /** True when we fell back to the global rating for this country. */
  global: boolean;
};

/** What a user in `country` sees for a broker. Applies the rollout rule above; never changes a number. */
export function countryView(
  globalRating: { verdict: BtsVerdict; score: number | null },
  row: CountryFitRow | null | undefined,
  country: string,
): CountryView {
  const fallback = (note: string | null): CountryView => ({ country, verdict: globalRating.verdict, score: globalRating.score, note, global: true });
  if (country === "XX" || !row) return fallback(null);
  if (row.fit === "NO LOCAL LICENCE VERIFIED" && !FULL_COUNTRY_VERDICTS.has(country)) {
    return fallback(`Local licence check for ${countryName(country)} in progress. Showing the global rating.`);
  }
  const verdict = toVerdict(row.verdict);
  return { country, verdict, score: SCORELESS.has(verdict) ? null : row.score, note: row.note, global: false };
}
