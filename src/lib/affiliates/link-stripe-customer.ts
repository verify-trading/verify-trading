function getRewardfulReferralId(): string | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { Rewardful?: { referral?: string | null } };
  const referral = w.Rewardful?.referral;
  return typeof referral === "string" && referral.length > 0 ? referral : null;
}

/**
 * Link the current signed-in user to a Stripe customer with the
 * affiliate referral attached. This is what enables Rewardful to
 * count the signup as a Lead.
 *
 * Silently fails — never blocks the UX over affiliate tracking.
 */
export async function linkAffiliateReferral() {
  const referralId = getRewardfulReferralId();
  if (!referralId) return;

  try {
    await fetch("/api/affiliates/link-stripe-customer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referralId }),
    });
  } catch (err) {
    console.warn("Failed to link affiliate referral:", err);
  }
}
