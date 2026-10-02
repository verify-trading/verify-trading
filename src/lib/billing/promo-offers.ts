import type { BillingPlanKey } from "@/lib/billing/config";

export const PROMO_OFFER_COOKIE_NAME = "vt_promo_offer";
export const TUBMAN_OFFER_KEY = "tubman-14-day";
export const MONTHLY_TRIAL_OFFER_KEY = "monthly-14-day";
export const TUBMAN_REFERRAL_TOKEN = "Tubman";

export const BILLING_PROMO_OFFER_KEYS = [TUBMAN_OFFER_KEY, MONTHLY_TRIAL_OFFER_KEY] as const;
export type BillingPromoOfferKey = (typeof BILLING_PROMO_OFFER_KEYS)[number];

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
  [MONTHLY_TRIAL_OFFER_KEY]: {
    key: MONTHLY_TRIAL_OFFER_KEY,
    plan: "monthly",
    trialPeriodDays: 14,
  },
};

export function isBillingPromoOfferKey(
  value: string | null,
): value is BillingPromoOfferKey {
  return BILLING_PROMO_OFFER_KEYS.some((key) => key === value);
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

export function getPromoBillingPath(offer: BillingPromoOffer): string {
  return `/billing?plan=${offer.plan}&offer=${offer.key}`;
}
