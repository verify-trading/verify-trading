import { computeBrokerTrustScore, type BtsBand } from "@/lib/ask/bts";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type VerifiedEntityType = "broker" | "guru" | "propfirm";
export type VerifiedEntityStatus = "legitimate" | "warning" | "avoid";

export interface VerifiedEntity {
  id: string;
  name: string;
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
}

export interface LookupVerifiedEntityResult {
  found: boolean;
  entity?: VerifiedEntity;
  brokerCardHint?: {
    name: string;
    score: string;
    status: "LEGITIMATE" | "WARNING" | "AVOID";
    fca: "Yes" | "No";
    complaints: "Low" | "Medium" | "High";
    color: "green" | "red";
    provisional: boolean;
    band: BtsBand | null;
    founderNote: string | null;
  };
  guruCardHint?: {
    name: string;
    score: string;
    status: "LEGITIMATE" | "WARNING" | "AVOID";
    verified: "Yes" | "No";
    color: "green" | "red";
  };
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

function deriveGuruVerified(status: VerifiedEntityStatus, notes: string, trustScore: number) {
  const lowerNotes = notes.toLowerCase();
  if (status !== "legitimate") {
    return "No" as const;
  }

  if (lowerNotes.includes("no verified") || lowerNotes.includes("unverified")) {
    return "No" as const;
  }

  return trustScore >= 7 ? "Yes" : "No";
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

async function loadVerifiedEntitiesFromSupabase(): Promise<VerifiedEntity[]> {
  const client = getSupabaseAdminClient();
  if (!client) {
    return [];
  }

  const { data, error } = await client.from("verified_entities").select(
    "slug, name, entity_type, status, fca_registered, fca_reference, fca_warning, trust_score, notes, source, aliases, regulators_listed, leverage, final_tier, final_status, founder_verified, founder_notes, verification_method",
  );

  if (error || !data) {
    return [];
  }

  return data.map((row) => {
    const finalTier = (row.final_tier as string | null) ?? null;
    const founderVerified = Boolean(row.founder_verified);
    const founderNotes = (row.founder_notes as string | null) ?? null;
    const leverage = (row.leverage as string | null) ?? null;
    const regulatorsListed = (row.regulators_listed as string | null) ?? null;
    const verificationMethod = (row.verification_method as string | null) ?? null;

    // BTS rows (with a tier) compute their score on read from stored inputs;
    // legacy rows (gurus / prop firms / pre-BTS brokers) keep their stored score.
    const stored = row.trust_score === null ? null : Number(row.trust_score);
    const computed = finalTier
      ? computeBrokerTrustScore({
          finalTier,
          finalStatus: (row.final_status as string | null) ?? null,
          founderVerified,
          leverage,
          regulatorsListed,
          verificationMethod,
        })
      : null;

    return {
      id: row.slug as string,
      name: row.name as string,
      type: row.entity_type as VerifiedEntityType,
      status: row.status as VerifiedEntityStatus,
      fcaRegistered: Boolean(row.fca_registered),
      fcaReference: (row.fca_reference as string | null) ?? null,
      fcaWarning: Boolean(row.fca_warning),
      trustScore: computed ? computed.score : (stored ?? 0),
      notes: (row.notes as string | null) ?? "",
      source: (row.source as string | null) ?? "",
      aliases: Array.isArray(row.aliases)
        ? row.aliases.map((alias) => String(alias))
        : createAliases(String(row.name)),
      finalTier,
      founderVerified,
      founderNotes,
      leverage,
      regulatorsListed,
      verificationMethod,
      band: computed ? computed.band : null,
      provisional: computed ? computed.provisional : false,
    };
  });
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
  score: string;
  status: VerifiedEntityStatus;
  band: BtsBand | null;
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
    .sort((a, b) => b.trustScore - a.trustScore)
    .slice(0, Math.max(1, Math.min(limit, 15)))
    .map((entity) => ({
      name: entity.name,
      type: entity.type,
      score: formatTrustScore(entity.provisional, entity.trustScore),
      status: entity.status,
      band: entity.band ?? null,
      founderNote: entity.founderNotes ?? null,
      fcaRegistered: entity.fcaRegistered,
    }));
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

    if (normalizedQuery === normalizeEntityText(entity.name)) {
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
    brokerCardHint: {
      name: match.name,
      // Unverified rows show "Provisional", never a hard score.
      score: formatTrustScore(match.provisional, match.trustScore),
      status: mapStatus(match.status),
      fca: match.fcaRegistered ? "Yes" : "No",
      complaints: deriveComplaints(match.status, match.notes, match.fcaWarning),
      color: mapColor(match.status),
      provisional: match.provisional ?? false,
      band: match.band ?? null,
      founderNote: match.founderNotes ?? null,
    },
    guruCardHint: {
      name: match.name,
      score: formatTrustScore(match.provisional, match.trustScore),
      status: mapStatus(match.status),
      verified: deriveGuruVerified(match.status, match.notes, match.trustScore),
      color: mapColor(match.status),
    },
  };
}
