import { computeBrokerTrustScore, type BtsBand } from "@/lib/ask/bts";
import {
  httpUrlSchema,
  type CardConfirmedFact,
  type EntityCardFacts,
} from "@/lib/ask/contracts";
import { computePropFirmScore, type PropFirmBand } from "@/lib/ask/prop-firms";
import { resolveGuruTier, type GuruTier } from "@/lib/ask/gurus";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type VerifiedEntityType = "broker" | "guru" | "propfirm";
export type VerifiedEntityStatus = "legitimate" | "warning" | "avoid";

export type { CardConfirmedFact, EntityCardFacts };

/** Marks a record retained on discovery but never scored. Single source of truth. */
export const DEVELOPING_RESEARCH_STATUS = "DEVELOPING — MONITOR";

export interface TrustpilotSnapshot {
  rating: number;
  count: number | null;
  date: string | null;
}

export interface DevelopingPropFirmInput {
  name: string;
  confirmed: CardConfirmedFact[];
  unconfirmed?: string[];
  reverifyTrigger?: string | null;
  trustpilot?: { rating: number; count: number | null; date?: string | null } | null;
}

// Reviews can surface leads quickly, but their allegations are not verified
// facts. They remain useful on a developing record, under the explicit
// unconfirmed section rather than the confirmed card section.
const SECONDHAND_REVIEW_HOSTS = new Set([
  "trustpilot.com",
  "reddit.com",
  "forexpeacearmy.com",
  "fundedtrading.com",
  "myfxbook.com",
]);

function isSecondhandReviewSource(url: string | null | undefined) {
  if (!url) return false;
  let hostname: string;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return true;
  }
  for (const domain of SECONDHAND_REVIEW_HOSTS) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) {
      return true;
    }
  }
  return false;
}

export interface VerifiedEntity {
  id: string;
  name: string;
  /** Normalized name, precomputed once at load for the lookup hot path. */
  normalizedName: string;
  type: VerifiedEntityType;
  status: VerifiedEntityStatus;
  fcaRegistered: boolean;
  fcaReference: string | null;
  fcaWarning: boolean;
  trustScore: number;
  notes: string;
  source: string;
  aliases: string[];
  /** aliases with spaces stripped, precomputed once for the lookup hot path. */
  collapsedAliases: string[];
  // BTS inputs and computed score, present only on brokers from the BTS master.
  finalTier?: string | null;
  founderVerified?: boolean;
  founderNotes?: string | null;
  leverage?: string | null;
  regulatorsListed?: string | null;
  verificationMethod?: string | null;
  /** Computed trust band, e.g. "Strongly Trusted". Null for legacy rows. */
  band?: BtsBand | null;
  /** True when the row still awaits live/register verification. */
  provisional?: boolean;
  // Prop firm (entity_type = 'propfirm') compute-on-read results.
  notRated?: boolean;
  propBand?: PropFirmBand | null;
  closed?: boolean;
  trustpilot?: TrustpilotSnapshot | null;
  /** Raw research status, e.g. "DEVELOPING — MONITOR". Prop firms only. */
  researchStatus?: string | null;
  /** Curated structured facts for developing firms; null when not curated. */
  cardFacts?: EntityCardFacts | null;
  // Guru (entity_type = 'guru') resolved tier + gated publish flag.
  guruTier?: GuruTier;
  guruPublishable?: boolean;
  trackRecord?: string | null;
  citationUrl?: string | null;
  bioSummary?: string | null;
}

export interface BrokerCardHint {
  name: string;
  score: string;
  status: "LEGITIMATE" | "WARNING" | "AVOID";
  fca: "Yes" | "No";
  complaints: "Low" | "Medium" | "High";
  color: "green" | "red";
  provisional: boolean;
  band: BtsBand | null;
  founderNote: string | null;
}

export interface PropFirmCardHint {
  name: string;
  /** Numeric score to 1dp, or "Not yet rated". */
  score: string;
  band: PropFirmBand | null;
  status: "LEGITIMATE" | "WARNING" | "AVOID";
  complaints: "Low" | "Medium" | "High";
  color: "green" | "red";
  notRated: boolean;
  closed: boolean;
  trustpilot: TrustpilotSnapshot | null;
  founderNote: string | null;
  researchStatus: string | null;
  cardFacts: EntityCardFacts | null;
}

export interface GuruCardHint {
  name: string;
  tier: GuruTier;
  /** Track-record badge text, e.g. "No". */
  trackRecord: string;
  /** Citation URL, present only when the resolved tier is Caution. */
  citationUrl: string | null;
}

export interface LookupVerifiedEntityResult {
  found: boolean;
  entity?: VerifiedEntity;
  brokerCardHint?: BrokerCardHint;
  propFirmCardHint?: PropFirmCardHint;
  guruCardHint?: GuruCardHint;
}

let verifiedEntitiesCache: Promise<VerifiedEntity[]> | undefined;
let tokenIndexCache: Promise<Map<string, VerifiedEntity[]>> | undefined;
let verifiedEntitiesLoadedAt = 0;
let verifiedEntitiesReloading = false;

/**
 * Dashboard edits must reach warm serverless instances without a redeploy, so
 * the in-memory entity list expires and reloads after this window.
 */
const VERIFIED_ENTITIES_TTL_MS = 60_000;

/** Display score: "Provisional" until verified, otherwise the trust score to 1dp. */
function formatTrustScore(provisional: boolean | undefined, trustScore: number) {
  return provisional ? "Provisional" : trustScore.toFixed(1);
}

export function normalizeEntityText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function collapseEntityText(value: string) {
  return normalizeEntityText(value).replace(/\s+/g, "");
}

function createAliases(name: string) {
  const base = normalizeEntityText(name);
  const aliases = new Set<string>([base, collapseEntityText(name)]);
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

function deriveComplaints(status: VerifiedEntityStatus, notes: string, fcaWarning: boolean) {
  const lowerNotes = notes.toLowerCase();
  if (fcaWarning || status === "avoid") {
    return "High" as const;
  }

  if (
    status === "warning" ||
    lowerNotes.includes("complaint") ||
    lowerNotes.includes("caution") ||
    lowerNotes.includes("conflict")
  ) {
    return "Medium" as const;
  }

  return "Low" as const;
}

function mapStatus(status: VerifiedEntityStatus) {
  switch (status) {
    case "legitimate":
      return "LEGITIMATE" as const;
    case "warning":
      return "WARNING" as const;
    default:
      return "AVOID" as const;
  }
}

function mapColor(status: VerifiedEntityStatus) {
  return status === "legitimate" ? ("green" as const) : ("red" as const);
}

/** Prop-firm band -> the legitimate/warning/avoid status used for colour + complaints. */
function propStatusFromBand(band: PropFirmBand | null): VerifiedEntityStatus {
  if (band === "Strongly Trusted" || band === "Trusted") {
    return "legitimate";
  }
  if (band === "Avoid") {
    return "avoid";
  }
  return "warning";
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringOrNull(value: unknown): string | null {
  return (value as string | null) ?? null;
}

function toTrimmedStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** A source link only when it is a real http(s) URL; a bad one drops to null. */
function sanitizeHttpUrl(value: unknown): string | null {
  const trimmed = toTrimmedStringOrNull(value);
  return trimmed && httpUrlSchema.safeParse(trimmed).success ? trimmed : null;
}

/**
 * Defensive parse of the card_facts jsonb column. Malformed entries are dropped
 * per-field rather than throwing — one bad sourceUrl drops only that link, never
 * the fact or the whole card — and an empty result maps to null so callers can
 * treat "no curated facts" uniformly.
 */
function parseCardFacts(value: unknown): EntityCardFacts | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;

  const confirmed: CardConfirmedFact[] = Array.isArray(raw.confirmed)
    ? raw.confirmed.flatMap((item) => {
        if (!item || typeof item !== "object") {
          return [];
        }
        const fact = item as Record<string, unknown>;
        const text = toTrimmedStringOrNull(fact.text);
        if (!text) {
          return [];
        }
        return [
          {
            text,
            sourceLabel: toTrimmedStringOrNull(fact.sourceLabel),
            sourceUrl: sanitizeHttpUrl(fact.sourceUrl),
          },
        ];
      })
    : [];

  const unconfirmed: string[] = Array.isArray(raw.unconfirmed)
    ? raw.unconfirmed.flatMap((item) => {
        const text = toTrimmedStringOrNull(item);
        return text ? [text] : [];
      })
    : [];

  const footer = toTrimmedStringOrNull(raw.footer);

  if (confirmed.length === 0 && unconfirmed.length === 0 && !footer) {
    return null;
  }

  return { confirmed, unconfirmed, footer };
}

const ENTITY_COLUMNS =
  "slug, name, entity_type, status, fca_registered, fca_reference, fca_warning, trust_score, " +
  "notes, source, aliases, regulators_listed, leverage, final_tier, final_status, " +
  "founder_verified, founder_notes, verification_method, firm_status, " +
  "trustpilot_rating, trustpilot_count, trustpilot_date, founder_override_score, " +
  "guru_tier, founder_tier_override, regulator_flag_source, " +
  "verified_track_record, research_status, identity_confirmed, bio_summary, card_facts";

function mapEntityRow(row: Record<string, unknown>): VerifiedEntity {
  const type = row.entity_type as VerifiedEntityType;
  const name = row.name as string;
  const aliases = Array.isArray(row.aliases)
    ? row.aliases.map((alias) => String(alias))
    : createAliases(name);
  const base = {
    id: row.slug as string,
    name,
    normalizedName: normalizeEntityText(name),
    type,
    status: row.status as VerifiedEntityStatus,
    fcaRegistered: Boolean(row.fca_registered),
    fcaReference: toStringOrNull(row.fca_reference),
    fcaWarning: Boolean(row.fca_warning),
    notes: toStringOrNull(row.notes) ?? "",
    source: toStringOrNull(row.source) ?? "",
    aliases,
    collapsedAliases: aliases.map((alias) => alias.replace(/ /g, "")),
  };

  if (type === "propfirm") {
    const prop = computePropFirmScore({
      firmStatus: toStringOrNull(row.firm_status),
      autoScore: toNumberOrNull(row.trust_score),
      founderOverrideScore: toNumberOrNull(row.founder_override_score),
    });
    const rating = toNumberOrNull(row.trustpilot_rating);
    const cardFacts = parseCardFacts(row.card_facts);
    // A developing record's note is derived from its confirmed card facts (one
    // source), so a curator editing card_facts can never leave a stale founder
    // note that contradicts the rendered card. Scored rows keep their column.
    const founderNotes =
      cardFacts && cardFacts.confirmed.length > 0
        ? cardFacts.confirmed.map((fact) => fact.text).join(" ")
        : toStringOrNull(row.founder_notes);
    return {
      ...base,
      status: propStatusFromBand(prop.band),
      trustScore: prop.score ?? 0,
      founderNotes,
      notRated: prop.notRated,
      propBand: prop.band,
      closed: prop.closed,
      researchStatus: toTrimmedStringOrNull(row.research_status),
      cardFacts,
      trustpilot:
        rating === null
          ? null
          : {
              rating,
              count: toNumberOrNull(row.trustpilot_count),
              date: toStringOrNull(row.trustpilot_date),
            },
    };
  }

  if (type === "guru") {
    const resolution = resolveGuruTier({
      tier: toStringOrNull(row.guru_tier),
      founderTierOverride: toStringOrNull(row.founder_tier_override),
      regulatorFlagSource: toStringOrNull(row.regulator_flag_source),
      verifiedTrackRecord: toStringOrNull(row.verified_track_record),
      researchStatus: toStringOrNull(row.research_status),
      identityConfirmed: Boolean(row.identity_confirmed),
    });
    return {
      ...base,
      // Gurus carry no numeric score; status stays neutral and the card uses the tier.
      trustScore: 0,
      guruTier: resolution.tier,
      guruPublishable: resolution.publishable,
      trackRecord: toStringOrNull(row.verified_track_record),
      citationUrl: resolution.tier === "Caution" ? toStringOrNull(row.regulator_flag_source) : null,
      bioSummary: toStringOrNull(row.bio_summary),
    };
  }

  // Brokers (BTS): compute the score on read from the stored tier inputs.
  const finalTier = toStringOrNull(row.final_tier);
  const founderVerified = Boolean(row.founder_verified);
  const leverage = toStringOrNull(row.leverage);
  const regulatorsListed = toStringOrNull(row.regulators_listed);
  const verificationMethod = toStringOrNull(row.verification_method);
  const stored = toNumberOrNull(row.trust_score);
  const computed = finalTier
    ? computeBrokerTrustScore({
        finalTier,
        finalStatus: toStringOrNull(row.final_status),
        founderVerified,
        leverage,
        regulatorsListed,
        verificationMethod,
      })
    : null;

  return {
    ...base,
    trustScore: computed ? computed.score : (stored ?? 0),
    finalTier,
    founderVerified,
    founderNotes: toStringOrNull(row.founder_notes),
    leverage,
    regulatorsListed,
    verificationMethod,
    band: computed ? computed.band : null,
    provisional: computed ? computed.provisional : false,
  };
}

async function loadVerifiedEntitiesFromSupabase(): Promise<VerifiedEntity[]> {
  const client = getSupabaseAdminClient();
  if (!client) {
    return [];
  }

  const { data, error } = await client.from("verified_entities").select(ENTITY_COLUMNS);
  if (error || !data) {
    return [];
  }

  // Unpublishable gurus (thin research or identity-on-hold) are excluded
  // entirely so they can never match or be listed.
  return data
    .map((row) => mapEntityRow(row as unknown as Record<string, unknown>))
    .filter((entity) => entity.type !== "guru" || entity.guruPublishable);
}

/** Clears the in-memory entity list cache (e.g. after tests or long-running reload hooks). */
export function clearVerifiedEntitiesCache() {
  verifiedEntitiesCache = undefined;
  tokenIndexCache = undefined;
  verifiedEntitiesLoadedAt = 0;
  verifiedEntitiesReloading = false;
}

/**
 * Fast-path persistence for a previously unknown prop firm discovered through
 * live web research. It deliberately creates a developing, unscored record:
 * discovery is enough to retain cited facts, never enough to award a score.
 */
export async function upsertDevelopingPropFirm(input: DevelopingPropFirmInput) {
  const client = getSupabaseAdminClient();
  if (!client) {
    return { saved: false, reason: "Database is not configured." } as const;
  }

  const name = input.name.trim();
  const slug = collapseEntityText(name);
  if (!name || !slug || input.confirmed.length === 0) {
    return { saved: false, reason: "A firm name and at least one cited fact are required." } as const;
  }

  // Never clobber a human-scored or otherwise curated record. Discovery may only
  // create a fresh developing row or refresh an existing developing one; a scored
  // row (trust_score set) or any non-developing record is left untouched. This
  // invariant lives here, not in the prompt, so a mis-ordered tool call or a slug
  // collision can't silently null a trust score or overwrite curated card_facts.
  const { data: existing, error: readError } = await client
    .from("verified_entities")
    .select("trust_score, research_status")
    .eq("slug", slug)
    .maybeSingle();
  if (readError) {
    return { saved: false, reason: readError.message } as const;
  }
  if (
    existing &&
    (existing.trust_score !== null || existing.research_status !== DEVELOPING_RESEARCH_STATUS)
  ) {
    return {
      saved: false,
      reason: "A reviewed record already exists for this firm; leaving it untouched.",
    } as const;
  }

  const confirmed = input.confirmed.filter((fact) => !isSecondhandReviewSource(fact.sourceUrl));
  const reviewClaims = input.confirmed
    .filter((fact) => isSecondhandReviewSource(fact.sourceUrl))
    .map((fact) => `${fact.text} [Reported by ${fact.sourceLabel ?? "a review source"}]`);
  const cardFacts: EntityCardFacts = {
    confirmed,
    unconfirmed: [...reviewClaims, ...(input.unconfirmed ?? [])],
    footer: input.reverifyTrigger?.trim() || "Re-verify when an official firm statement is available.",
  };
  const sourceLabels = [...new Set(confirmed.map((fact) => fact.sourceLabel).filter(Boolean))];

  // founder_notes is intentionally not written: for a developing record the note
  // is derived from card_facts on read, so there is no second copy to drift.
  const { error } = await client.from("verified_entities").upsert(
    {
      slug,
      name,
      entity_type: "propfirm",
      status: "warning",
      trust_score: null,
      notes: "Developing record: no final trust score while evidence is being monitored.",
      source: sourceLabels.length > 0 ? sourceLabels.join("; ") : "Live web research",
      aliases: createAliases(name),
      firm_status: "Operating — monitoring",
      trustpilot_rating: input.trustpilot?.rating ?? null,
      trustpilot_count: input.trustpilot?.count ?? null,
      trustpilot_date: input.trustpilot?.date ?? null,
      research_status: DEVELOPING_RESEARCH_STATUS,
      card_facts: cardFacts,
    },
    { onConflict: "slug" },
  );

  if (error) {
    return { saved: false, reason: error.message } as const;
  }

  clearVerifiedEntitiesCache();
  return { saved: true, slug } as const;
}

async function getVerifiedEntities() {
  // First load: nothing to serve, so the caller waits for it.
  if (!verifiedEntitiesCache) {
    verifiedEntitiesCache = loadVerifiedEntitiesFromSupabase();
    verifiedEntitiesLoadedAt = Date.now();
    tokenIndexCache = undefined;
    return verifiedEntitiesCache;
  }

  // Stale-while-revalidate: once loaded, keep serving the resolved list and swap
  // it in the background when it expires, so no request stalls on a full reload
  // and a failed reload just keeps the last-good list until the next window.
  const expired = Date.now() - verifiedEntitiesLoadedAt > VERIFIED_ENTITIES_TTL_MS;
  if (expired && !verifiedEntitiesReloading) {
    verifiedEntitiesReloading = true;
    void loadVerifiedEntitiesFromSupabase()
      .then((entities) => {
        verifiedEntitiesCache = Promise.resolve(entities);
        verifiedEntitiesLoadedAt = Date.now();
        // The token index derives from the entity list; keep them in lockstep.
        tokenIndexCache = undefined;
      })
      .catch(() => {
        // Keep serving the stale list; retry on the next expiry window.
      })
      .finally(() => {
        verifiedEntitiesReloading = false;
      });
  }

  return verifiedEntitiesCache;
}

/**
 * Tokens too common to anchor a "did you mean" suggestion on their own — they
 * appear across many firms, so sharing one means nothing.
 */
const COMMON_NAME_TOKENS = new Set([
  // Industry words — shared by countless firms, so sharing one means nothing.
  "fx", "forex", "trading", "trade", "trader", "traders", "capital", "markets",
  "market", "fund", "funds", "funded", "funding", "group", "global", "invest",
  "investing", "pro", "signals", "signal", "academy", "official", "international",
  "finance", "financial", "prime", "gold", "money", "wealth", "the", "and",
  "firm", "firms", "prop", "broker", "brokers", "company", "online", "team",
  "course", "courses", "mentor", "fintech", "ventures", "limited",
  // Question / filler words that ride along in natural-language queries.
  "good", "best", "this", "that", "safe", "legit", "legitimate", "scam", "scams",
  "review", "reviews", "with", "what", "about", "which", "recommend", "trust",
  "trusted", "deposit", "really", "still", "their", "they", "from", "your",
]);

/** A shared token counts as distinctive only if at most this many entities use it. */
const MAX_DISTINCTIVE_SHARE = 3;
const MIN_TOKEN_LENGTH = 4;

function distinctiveTokens(text: string): string[] {
  return text
    .split(" ")
    .filter((token) => token.length >= MIN_TOKEN_LENGTH && !COMMON_NAME_TOKENS.has(token));
}

/** token -> entities whose name/aliases use it. Built lazily, cleared with the entity cache. */
async function getTokenIndex(): Promise<Map<string, VerifiedEntity[]>> {
  if (!tokenIndexCache) {
    tokenIndexCache = (async () => {
      const entities = await getVerifiedEntities();
      const index = new Map<string, VerifiedEntity[]>();
      for (const entity of entities) {
        const tokens = new Set<string>();
        for (const text of [entity.normalizedName, ...entity.aliases]) {
          for (const token of distinctiveTokens(text)) {
            tokens.add(token);
          }
        }
        for (const token of tokens) {
          const bucket = index.get(token);
          if (bucket) {
            bucket.push(entity);
          } else {
            index.set(token, [entity]);
          }
        }
      }
      return index;
    })();
  }
  return tokenIndexCache;
}

function isFlagged(entity: VerifiedEntity): boolean {
  return entity.status === "avoid" || entity.status === "warning" || entity.guruTier === "Caution";
}

/** Character trigrams of a string, for typo-tolerant (Dice) similarity. */
function trigrams(value: string): Set<string> {
  const padded = `  ${value} `;
  const set = new Set<string>();
  for (let i = 0; i < padded.length - 2; i += 1) set.add(padded.slice(i, i + 3));
  return set;
}

function diceCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const gram of a) if (b.has(gram)) shared += 1;
  return (2 * shared) / (a.size + b.size);
}

/** Label tells the model how much to trust a candidate. NEVER a confirmed verdict. */
export type EntityCandidateLabel = "lookalike" | "similar";

export interface EntityCandidate {
  entity: VerifiedEntity;
  /** The brand the query is close to, e.g. "astro fx". */
  brand: string;
  /** "lookalike" = shares a rare distinctive word; "similar" = close spelling (typo). */
  label: EntityCandidateLabel;
  flagged: boolean;
  score: number;
}

const FUZZY_SIMILARITY_FLOOR = 0.72;

function shortestAliasWith(entity: VerifiedEntity, token: string): string {
  return (
    entity.aliases
      .filter((alias) => alias.split(" ").includes(token))
      .sort((a, b) => a.length - b.length)[0] ?? token
  );
}

/**
 * For a name we hold NO confident record of, surface the closest brands the user
 * might mean, each LABELLED — never asserted as identity. The model phrases the
 * "did you mean X?" and decides; we only supply scored, defensible candidates.
 * Two signals: a rare shared word (lookalike) and close spelling (similar/typo).
 */
export async function findEntityCandidates(query: string, limit = 3): Promise<EntityCandidate[]> {
  const normalized = normalizeEntityText(query);
  const collapsed = collapseEntityText(query);
  const queryTokens = distinctiveTokens(normalized);
  const index = await getTokenIndex();
  const entities = await getVerifiedEntities();

  const best = new Map<string, EntityCandidate>();
  const consider = (candidate: EntityCandidate) => {
    const existing = best.get(candidate.entity.id);
    if (!existing || candidate.score > existing.score) {
      best.set(candidate.entity.id, candidate);
    }
  };

  // 1) Lookalike: shares a rare, distinctive word (e.g. "astro").
  for (const token of queryTokens) {
    const matches = index.get(token);
    if (!matches || matches.length > MAX_DISTINCTIVE_SHARE) continue;
    for (const entity of matches) {
      const flagged = isFlagged(entity);
      consider({
        entity,
        brand: shortestAliasWith(entity, token),
        label: "lookalike",
        flagged,
        score: 1 + 1 / matches.length + (flagged ? 0.1 : 0),
      });
    }
  }

  // 2) Similar spelling: trigram-close to a name/alias (typos like "peperstone").
  // Only when the query carries a distinctive token — a pure run of common words
  // ("global fx markets") should never fuzzy-match a real firm.
  if (collapsed.length >= 4 && queryTokens.length > 0) {
    const queryGrams = trigrams(collapsed);
    for (const entity of entities) {
      let bestSim = 0;
      let bestAlias = entity.normalizedName;
      // Aliases carry their collapsed form already; reuse it rather than re-strip.
      entity.collapsedAliases.forEach((collapsedAlias, i) => {
        const sim = diceCoefficient(queryGrams, trigrams(collapsedAlias));
        if (sim > bestSim) {
          bestSim = sim;
          bestAlias = entity.aliases[i] ?? entity.normalizedName;
        }
      });
      if (bestSim >= FUZZY_SIMILARITY_FLOOR) {
        consider({
          entity,
          brand: bestAlias,
          label: "similar",
          flagged: isFlagged(entity),
          score: bestSim,
        });
      }
    }
  }

  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

export interface VerifiedEntityListItem {
  name: string;
  type: VerifiedEntityType;
  /** Numeric score, "Provisional"/"Not yet rated", or the guru tier. */
  score: string;
  status: VerifiedEntityStatus;
  band: string | null;
  founderNote: string | null;
  fcaRegistered: boolean;
}

/** Top reviewed entities of a type, highest trust first, for "best/top/list" queries. */
export async function listVerifiedEntities(
  type: VerifiedEntityType,
  limit = 8,
): Promise<VerifiedEntityListItem[]> {
  const entities = await getVerifiedEntities();
  return entities
    .filter((entity) => entity.type === type)
    .sort((a, b) => guruTierRank(b) - guruTierRank(a) || b.trustScore - a.trustScore)
    .slice(0, Math.max(1, Math.min(limit, 15)))
    .map((entity) => ({
      name: entity.name,
      type: entity.type,
      score: listScore(entity),
      status: entity.status,
      band: entity.propBand ?? entity.band ?? null,
      founderNote: entity.founderNotes ?? null,
      fcaRegistered: entity.fcaRegistered,
    }));
}

/** Verified gurus rank above Unverified above Caution; non-gurus are unaffected. */
function guruTierRank(entity: VerifiedEntity) {
  switch (entity.guruTier) {
    case "Verified":
      return 2;
    case "Unverified":
      return 1;
    default:
      return 0;
  }
}

function listScore(entity: VerifiedEntity): string {
  if (entity.type === "guru") {
    return entity.guruTier ?? "Unverified";
  }
  if (entity.notRated) {
    return "Not yet rated";
  }
  return formatTrustScore(entity.provisional, entity.trustScore);
}

function buildCardHints(entity: VerifiedEntity): Pick<
  LookupVerifiedEntityResult,
  "brokerCardHint" | "propFirmCardHint" | "guruCardHint"
> {
  if (entity.type === "propfirm") {
    return {
      propFirmCardHint: {
        name: entity.name,
        score: entity.notRated ? "Not yet rated" : entity.trustScore.toFixed(1),
        band: entity.propBand ?? null,
        status: mapStatus(entity.status),
        complaints: deriveComplaints(entity.status, entity.notes, entity.fcaWarning),
        color: mapColor(entity.status),
        notRated: entity.notRated ?? false,
        closed: entity.closed ?? false,
        trustpilot: entity.trustpilot ?? null,
        founderNote: entity.founderNotes ?? null,
        researchStatus: entity.researchStatus ?? null,
        cardFacts: entity.cardFacts ?? null,
      },
    };
  }

  if (entity.type === "guru") {
    return {
      guruCardHint: {
        name: entity.name,
        tier: entity.guruTier ?? "Unverified",
        trackRecord: entity.trackRecord ?? "No",
        citationUrl: entity.citationUrl ?? null,
      },
    };
  }

  return {
    brokerCardHint: {
      name: entity.name,
      // Unverified rows show "Provisional", never a hard score.
      score: formatTrustScore(entity.provisional, entity.trustScore),
      status: mapStatus(entity.status),
      fca: entity.fcaRegistered ? "Yes" : "No",
      complaints: deriveComplaints(entity.status, entity.notes, entity.fcaWarning),
      color: mapColor(entity.status),
      provisional: entity.provisional ?? false,
      band: entity.band ?? null,
      founderNote: entity.founderNotes ?? null,
    },
  };
}

export async function lookupVerifiedEntity(query: string): Promise<LookupVerifiedEntityResult> {
  const entities = await getVerifiedEntities();
  const normalizedQuery = normalizeEntityText(query);
  const collapsedQuery = collapseEntityText(query);
  const paddedQuery = ` ${normalizedQuery} `;

  // Collapsed forms of every contiguous token window (up to 4 tokens). This
  // matches spacing variants — "the 5ers" -> "the5ers", "ic markets" -> "icmarkets"
  // — while staying word-boundary aligned: each window is whole tokens, so a bare
  // substring like "amarkets" inside "zentova markets" -> "zentovamarkets" can
  // never match (that broke an unrelated firm, AMarkets).
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const windowForms = new Set<string>();
  for (let i = 0; i < queryTokens.length; i += 1) {
    let window = "";
    for (let j = i; j < Math.min(i + 4, queryTokens.length); j += 1) {
      window += queryTokens[j];
      windowForms.add(window);
    }
  }

  let match: VerifiedEntity | null = null;
  let bestScore = 0;
  for (const entity of entities) {
    let score = 0;

    for (const alias of entity.aliases) {
      if (normalizedQuery === alias || collapsedQuery === alias) {
        score = Math.max(score, 400);
      } else if (alias.length >= 4 && paddedQuery.includes(` ${alias} `)) {
        score = Math.max(score, 250);
      }
    }
    // Spacing variant: a query token-window collapses to a (precomputed) alias.
    for (const collapsedAlias of entity.collapsedAliases) {
      if (collapsedAlias.length >= 4 && windowForms.has(collapsedAlias)) {
        score = Math.max(score, 350);
        break;
      }
    }

    if (normalizedQuery === entity.normalizedName) {
      score = Math.max(score, 500);
    }

    if (score > bestScore) {
      match = entity;
      bestScore = score;
    }
  }
  if (!match) {
    return {
      found: false,
    };
  }

  return {
    found: true,
    entity: match,
    ...buildCardHints(match),
  };
}
