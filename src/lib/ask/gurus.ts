/**
 * Guru / educator tier, resolved on read. Gurus are named individuals, so an
 * unsupported negative statement is defamation — the single largest legal risk on
 * the platform. The rules here are written as hard constraints, not conventions.
 *
 * There is no numeric score for a person (a number implies a precision we cannot
 * defend). Instead three plain tiers, resolved by resolveGuruTier():
 *
 *   - Verified   — an independently-verified track record the platform has seen.
 *   - Unverified — the neutral, fully-defensible default. NOT an accusation.
 *   - Caution    — a documented regulator/court action exists, WITH a citation.
 *
 * The Caution gate is the legal backbone: a Caution can only ever be displayed
 * when a valid citation URL is stored against the row. This is enforced at the
 * database (a CHECK constraint) and again here on read, so even if an unsupported
 * Caution reaches the table, the read path still shows Unverified.
 */

import publishableStatuses from "@/lib/ask/guru-publishable-statuses.json";

export type GuruTier = "Verified" | "Unverified" | "Caution";

export interface GuruResolveInputs {
  tier: string | null;
  founderTierOverride: string | null;
  /** The citation that makes a Caution defensible (must be a valid http(s) URL). */
  regulatorFlagSource: string | null;
  verifiedTrackRecord: string | null;
  researchStatus: string | null;
  founderReviewed: boolean;
  identityConfirmed: boolean;
}

export interface GuruResolution {
  /** Public tier, after the Caution and Verified gates. */
  tier: GuruTier;
  /** A row is only eligible for public display once research + review gates pass. */
  publishable: boolean;
}

/**
 * Rows research-complete enough to publish once the founder has reviewed them.
 * The list is shared with the data scripts via a JSON file so the read gate and
 * the corpus gate (scripts/data/_shared.mjs) can never drift apart.
 */
const PUBLISHABLE_STATUSES = new Set(publishableStatuses);

/** Only an explicit confirmed record earns Verified; claims/disputes do not. */
const CONFIRMED_TRACK_RECORD = /^yes \(confirmed\)/i;

function normalizeTier(value: string | null): GuruTier {
  switch (value?.trim().toLowerCase()) {
    case "verified":
      return "Verified";
    case "caution":
      return "Caution";
    default:
      return "Unverified";
  }
}

export function isValidCitation(source: string | null): boolean {
  const trimmed = source?.trim() ?? "";
  if (!trimmed) {
    return false;
  }
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function resolveGuruTier(inputs: GuruResolveInputs): GuruResolution {
  // The founder override is respected, but it is subject to the same gates below
  // — it cannot publish an unsupported Caution or an unearned Verified.
  let tier = normalizeTier(inputs.founderTierOverride ?? inputs.tier);

  if (tier === "Caution" && !isValidCitation(inputs.regulatorFlagSource)) {
    tier = "Unverified";
  }

  if (tier === "Verified" && !CONFIRMED_TRACK_RECORD.test(inputs.verifiedTrackRecord ?? "")) {
    tier = "Unverified";
  }

  const publishable =
    PUBLISHABLE_STATUSES.has((inputs.researchStatus ?? "").trim().toLowerCase()) &&
    inputs.founderReviewed &&
    inputs.identityConfirmed;

  return { tier, publishable };
}
