import { computeBrokerTrustScore, type BtsBand } from "@/lib/ask/bts";
import { computePropFirmScore, type PropFirmBand } from "@/lib/ask/prop-firms";
import { resolveGuruTier, type GuruTier } from "@/lib/ask/gurus";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type VerifiedEntityType = "broker" | "guru" | "propfirm";
export type VerifiedEntityStatus = "legitimate" | "warning" | "avoid";

export interface TrustpilotSnapshot {
  rating: number;
  count: number | null;
  date: string | null;
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

/** Display score: "Provisional" until verified, otherwise the trust score to 1dp. */
function formatTrustScore(provisional: boolean | undefined, trustScore: number) {
  return provisional ? "Provisional" : trustScore.toFixed(1);
}

function normalizeEntityText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function collapseEntityText(value: string) {
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

const ENTITY_COLUMNS =
  "slug, name, entity_type, status, fca_registered, fca_reference, fca_warning, trust_score, " +
  "notes, source, aliases, regulators_listed, leverage, final_tier, final_status, " +
  "founder_verified, founder_notes, verification_method, firm_status, " +
  "trustpilot_rating, trustpilot_count, trustpilot_date, founder_override_score, " +
  "guru_tier, founder_tier_override, regulator_flag_source, " +
  "verified_track_record, research_status, founder_reviewed, identity_confirmed, bio_summary";

function mapEntityRow(row: Record<string, unknown>): VerifiedEntity {
  const type = row.entity_type as VerifiedEntityType;
  const name = row.name as string;
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
    aliases: Array.isArray(row.aliases)
      ? row.aliases.map((alias) => String(alias))
      : createAliases(name),
  };

  if (type === "propfirm") {
    const prop = computePropFirmScore({
      firmStatus: toStringOrNull(row.firm_status),
      autoScore: toNumberOrNull(row.trust_score),
      founderOverrideScore: toNumberOrNull(row.founder_override_score),
    });
    const rating = toNumberOrNull(row.trustpilot_rating);
    return {
      ...base,
      status: propStatusFromBand(prop.band),
      trustScore: prop.score ?? 0,
      founderNotes: toStringOrNull(row.founder_notes),
      notRated: prop.notRated,
      propBand: prop.band,
      closed: prop.closed,
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
      founderReviewed: Boolean(row.founder_reviewed),
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

  // Unpublishable gurus (thin research, unreviewed, or identity-on-hold) are
  // excluded entirely so they can never match or be listed.
  return data
    .map((row) => mapEntityRow(row as unknown as Record<string, unknown>))
    .filter((entity) => entity.type !== "guru" || entity.guruPublishable);
}

/** Clears the in-memory entity list cache (e.g. after tests or long-running reload hooks). */
export function clearVerifiedEntitiesCache() {
  verifiedEntitiesCache = undefined;
}

async function getVerifiedEntities() {
  if (!verifiedEntitiesCache) {
    verifiedEntitiesCache = loadVerifiedEntitiesFromSupabase();
  }

  return verifiedEntitiesCache;
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

  let match: VerifiedEntity | null = null;
  let bestScore = 0;
  for (const entity of entities) {
    let score = 0;

    for (const alias of entity.aliases) {
      if (normalizedQuery === alias || collapsedQuery === alias) {
        score = Math.max(score, 400);
      } else if (normalizedQuery.includes(alias) || collapsedQuery.includes(alias)) {
        score = Math.max(score, alias.length >= 4 ? 250 : 0);
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
