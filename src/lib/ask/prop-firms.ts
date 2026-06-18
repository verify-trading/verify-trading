/**
 * Prop Firm Trust Score, computed on read from the stored inputs so a founder
 * override, a closure, or a refreshed Trustpilot snapshot recalculates without a
 * re-run.
 *
 * Prop firms have no regulator, so there is no FCA/leverage rule here. The
 * displayed score follows a strict precedence (see computePropFirmScore):
 *   founder override > closed/defunct (Avoid) > computed baseline > "Not yet rated".
 *
 * The handover CSV ships the founder's blended `AUTO_overall_score` (derived from
 * the stability/payout pillars with Trustpilot data we don't carry per-row), so
 * that score is trusted as the baseline rather than re-derived from a weaker
 * approximation. This module owns the precedence, banding, and "Not yet rated"
 * state on top of it.
 */

export type PropFirmBand =
  | "Strongly Trusted"
  | "Trusted"
  | "Proceed With Caution"
  | "High Risk"
  | "Avoid";

export interface PropFirmScoreInputs {
  /** Closure note ("Closed down…") hard-overrides the score to Avoid. */
  firmStatus: string | null;
  /** Founder's blended baseline score (CSV AUTO_overall_score). */
  autoScore: number | null;
  /** Founder's firsthand score; wins outright when present. */
  founderOverrideScore: number | null;
}

export interface PropFirmScore {
  /** Displayed score, or null when the firm is "Not yet rated". */
  score: number | null;
  band: PropFirmBand | null;
  notRated: boolean;
  closed: boolean;
}

const PROP_BANDS: { min: number; band: PropFirmBand }[] = [
  { min: 8.5, band: "Strongly Trusted" },
  { min: 7.0, band: "Trusted" },
  { min: 5.0, band: "Proceed With Caution" },
  { min: 3.0, band: "High Risk" },
  { min: 0, band: "Avoid" },
];

function bandForScore(score: number): PropFirmBand {
  return (PROP_BANDS.find((entry) => score >= entry.min) ?? PROP_BANDS[PROP_BANDS.length - 1]).band;
}

function clampScore(value: number): number {
  return Math.round(Math.min(10, Math.max(0, value)) * 10) / 10;
}

export function isClosedFirm(firmStatus: string | null): boolean {
  return /closed|defunct|shut down|wound down/i.test(firmStatus ?? "");
}

export function computePropFirmScore(inputs: PropFirmScoreInputs): PropFirmScore {
  const closed = isClosedFirm(inputs.firmStatus);

  if (inputs.founderOverrideScore !== null) {
    const score = clampScore(inputs.founderOverrideScore);
    return { score, band: bandForScore(score), notRated: false, closed };
  }

  if (closed) {
    return { score: 1.0, band: "Avoid", notRated: false, closed: true };
  }

  if (inputs.autoScore === null) {
    return { score: null, band: null, notRated: true, closed: false };
  }

  const score = clampScore(inputs.autoScore);
  return { score, band: bandForScore(score), notRated: false, closed: false };
}
