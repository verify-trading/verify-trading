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
    "slug, name, entity_type, status, fca_registered, fca_reference, fca_warning, trust_score, notes, source, aliases",
  );

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.slug as string,
    name: row.name as string,
    type: row.entity_type as VerifiedEntityType,
    status: row.status as VerifiedEntityStatus,
    fcaRegistered: Boolean(row.fca_registered),
    fcaReference: (row.fca_reference as string | null) ?? null,
    fcaWarning: Boolean(row.fca_warning),
    trustScore: Number(row.trust_score),
    notes: row.notes as string,
    source: row.source as string,
    aliases: Array.isArray(row.aliases)
      ? row.aliases.map((alias) => String(alias))
      : createAliases(String(row.name)),
  }));
}

/** Clears the in-memory entity list cache (e.g. after tests or long-running reload hooks). */
export function clearVerifiedEntitiesCache() {
  verifiedEntitiesCache = undefined;
}

export async function getVerifiedEntities() {
  if (!verifiedEntitiesCache) {
    verifiedEntitiesCache = loadVerifiedEntitiesFromSupabase();
  }

  return verifiedEntitiesCache;
}

export async function lookupVerifiedEntity(query: string): Promise<LookupVerifiedEntityResult> {
  const entities = await getVerifiedEntities();
  const normalizedQuery = normalizeEntityText(query);
  const collapsedQuery = collapseEntityText(query);

  const scoredMatches = entities
    .map((entity) => {
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

      return { entity, score };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  const match = scoredMatches[0]?.entity;
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
      score: match.trustScore.toFixed(1),
      status: mapStatus(match.status),
      fca: match.fcaRegistered ? "Yes" : "No",
      complaints: deriveComplaints(match.status, match.notes, match.fcaWarning),
      color: mapColor(match.status),
    },
    guruCardHint: {
      name: match.name,
      score: match.trustScore.toFixed(1),
      status: mapStatus(match.status),
      verified: deriveGuruVerified(match.status, match.notes, match.trustScore),
      color: mapColor(match.status),
    },
  };
}
