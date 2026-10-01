import type { BillingPlanKey } from "@/lib/billing/config";

export const PROMO_OFFER_COOKIE_NAME = "vt_promo_offer";
export const TUBMAN_OFFER_KEY = "tubman-14-day";
export const TUBMAN_REFERRAL_TOKEN = "Tubman";

export type BillingPromoOfferKey = typeof TUBMAN_OFFER_KEY;

export type BillingPromoOffer = {
  key: BillingPromoOfferKey;
  plan: BillingPlanKey;
  trialPeriodDays: number;
};

const BILLING_PROMO_OFFERS: Record<BillingPromoOfferKey, BillingPromoOffer> = {
  [TUBMAN_OFFER_KEY]: {
    key: TUBMAN_OFFER_KEY,
    plan: "monthly",
    trialPeriodDays: 14,
  },
};

export function isBillingPromoOfferKey(
  value: string | null,
): value is BillingPromoOfferKey {
  return value === TUBMAN_OFFER_KEY;
}

export function getBillingPromoOffer(
  value: string | null,
): BillingPromoOffer | null {
  return isBillingPromoOfferKey(value)
    ? BILLING_PROMO_OFFERS[value]
    : null;
}

export function isTubmanReferralToken(value: string | null): boolean {
  return value?.trim().toLowerCase() === TUBMAN_REFERRAL_TOKEN.toLowerCase();
}

export function getTubmanBillingPath(): string {
  return `/billing?plan=monthly&offer=${TUBMAN_OFFER_KEY}`;
}
