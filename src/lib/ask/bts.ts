/**
 * Broker Trust Score, computed on read from the stored CSV inputs so a tier or
 * band change recalculates without a re-run.
 *
 * FCA-leverage rule: regulators cap retail leverage at 1:30, so a Tier-1 broker
 * advertising more is really onboarding the user to its offshore entity and is
 * scored as that entity. Founder-verified rows are exempt and trusted as listed.
 */

export type BtsTier = "Tier 1" | "Tier 2" | "Tier 3" | "Unregulated" | "Avoid";

export type BtsBand = "Strongly Trusted" | "Trusted" | "Proceed With Caution" | "Avoid";

export interface BtsScoreInputs {
  finalTier: string | null;
  finalStatus: string | null;
  founderVerified: boolean;
  leverage: string | null;
  regulatorsListed: string | null;
  verificationMethod: string | null;
}

export interface BtsScore {
  score: number;
  band: BtsBand;
  /** Row still awaits live register verification — show "Provisional", not a number. */
  provisional: boolean;
}

const TIER_BANDS: Record<BtsTier, { band: BtsBand; score: number; max: number }> = {
  "Tier 1": { band: "Strongly Trusted", score: 9.0, max: 10 },
  "Tier 2": { band: "Trusted", score: 7.7, max: 8.4 },
  "Tier 3": { band: "Proceed With Caution", score: 6.0, max: 6.9 },
  Unregulated: { band: "Avoid", score: 1.5, max: 2.9 },
  Avoid: { band: "Avoid", score: 1.5, max: 2.9 },
};

const TIER2_REGULATORS = /cysec|mas\b|dfsa|fsca|bafin|finma|fma\b|fsa\b/i;

function normalizeTier(value: string | null): BtsTier {
  switch (value?.trim().toLowerCase()) {
    case "tier 1":
      return "Tier 1";
    case "tier 2":
      return "Tier 2";
    case "tier 3":
      return "Tier 3";
    case "unregulated":
      return "Unregulated";
    default:
      return "Avoid";
  }
}

/** Max advertised leverage as a number, e.g. "1:500" -> 500. */
function parseLeverage(leverage: string | null): number | null {
  const match = leverage?.match(/1\s*:\s*(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function computeBrokerTrustScore(inputs: BtsScoreInputs): BtsScore {
  const founderLocked = inputs.founderVerified;
  const status = (inputs.finalStatus ?? "").toUpperCase();

  let tier = normalizeTier(inputs.finalTier);

  const leverage = parseLeverage(inputs.leverage);
  if (!founderLocked && tier === "Tier 1" && leverage !== null && leverage > 30) {
    tier = TIER2_REGULATORS.test(inputs.regulatorsListed ?? "") ? "Tier 2" : "Tier 3";
  }

  if (status.includes("AVOID")) {
    tier = "Avoid";
  } else if (status.includes("CAUTION") && (tier === "Tier 1" || tier === "Tier 2")) {
    tier = "Tier 3";
  }

  const band = TIER_BANDS[tier];
  const trusted = founderLocked && !status.includes("AVOID") && !status.includes("CAUTION");
  const score = trusted ? Math.min(band.max, band.score + 0.5) : band.score;

  return {
    score: Math.round(score * 10) / 10,
    band: band.band,
    provisional: !founderLocked && /needs (fca-api|register)/i.test(inputs.verificationMethod ?? ""),
  };
}
