import { afterEach, describe, expect, it } from "vitest";

import {
  getCheckoutBillingOffer,
  getPublicBillingPricing,
} from "@/lib/billing/config";

const ORIGINAL_ENV = {
  STRIPE_PRICE_PRO_MONTHLY_PROMO: process.env.STRIPE_PRICE_PRO_MONTHLY_PROMO,
  STRIPE_PROMO_COUPON_ID: process.env.STRIPE_PROMO_COUPON_ID,
  STRIPE_PRICE_PRO_MONTHLY_STANDARD: process.env.STRIPE_PRICE_PRO_MONTHLY_STANDARD,
  STRIPE_PRICE_PRO_ANNUAL: process.env.STRIPE_PRICE_PRO_ANNUAL,
  STRIPE_PROMO_END_AT: process.env.STRIPE_PROMO_END_AT,
};

afterEach(() => {
  process.env.STRIPE_PRICE_PRO_MONTHLY_PROMO = ORIGINAL_ENV.STRIPE_PRICE_PRO_MONTHLY_PROMO;
  process.env.STRIPE_PROMO_COUPON_ID = ORIGINAL_ENV.STRIPE_PROMO_COUPON_ID;
  process.env.STRIPE_PRICE_PRO_MONTHLY_STANDARD = ORIGINAL_ENV.STRIPE_PRICE_PRO_MONTHLY_STANDARD;
  process.env.STRIPE_PRICE_PRO_ANNUAL = ORIGINAL_ENV.STRIPE_PRICE_PRO_ANNUAL;
  process.env.STRIPE_PROMO_END_AT = ORIGINAL_ENV.STRIPE_PROMO_END_AT;
});

describe("billing config", () => {
  it("keeps public pricing plan-based before the promo cutoff", () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY_PROMO = "price_launch";
    process.env.STRIPE_PROMO_COUPON_ID = "coupon_launch";
    process.env.STRIPE_PRICE_PRO_MONTHLY_STANDARD = "price_standard";
    process.env.STRIPE_PRICE_PRO_ANNUAL = "price_annual";
    process.env.STRIPE_PROMO_END_AT = "2026-06-06T00:00:00+01:00";

    const pricing = getPublicBillingPricing(new Date("2026-06-05T12:00:00+01:00"));
    const checkout = getCheckoutBillingOffer("monthly", new Date("2026-06-05T12:00:00+01:00"));

    expect(pricing.free.headline).toBe("£0");
    expect(pricing.monthly.headline).toBe("£24.99/month");
    expect(pricing.annual.headline).toBe("£200/year");
    expect(pricing.monthly.promotion).toMatchObject({
      badge: "Launch offer",
      headline: "First month £5, then £20/month",
      ctaLabel: "Join for £5",
      compareAtHeadline: "£24.99/month",
    });
    expect(checkout.variant).toBe("launch");
    expect(checkout.checkoutPriceId).toBe("price_launch");
    expect(checkout.checkoutCouponId).toBe("coupon_launch");
  });

  it("keeps monthly as the canonical public plan after the promo cutoff", () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY_PROMO = "price_launch";
    process.env.STRIPE_PROMO_COUPON_ID = "coupon_launch";
    process.env.STRIPE_PRICE_PRO_MONTHLY_STANDARD = "price_standard";
    process.env.STRIPE_PRICE_PRO_ANNUAL = "price_annual";
    process.env.STRIPE_PROMO_END_AT = "2026-06-06T00:00:00+01:00";

    const pricing = getPublicBillingPricing(new Date("2026-06-06T00:00:00+01:00"));
    const checkout = getCheckoutBillingOffer("monthly", new Date("2026-06-06T00:00:00+01:00"));

    expect(pricing.monthly.headline).toBe("£24.99/month");
    expect(pricing.monthly.promotion).toBeNull();
    expect(checkout.variant).toBe("standard");
    expect(checkout.checkoutPriceId).toBe("price_standard");
    expect(checkout.checkoutCouponId).toBeNull();
  });

  it("uses the annual Stripe price without a launch coupon", () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY_PROMO = "price_launch";
    process.env.STRIPE_PROMO_COUPON_ID = "coupon_launch";
    process.env.STRIPE_PRICE_PRO_MONTHLY_STANDARD = "price_standard";
    process.env.STRIPE_PRICE_PRO_ANNUAL = "price_annual";
    process.env.STRIPE_PROMO_END_AT = "2026-06-06T00:00:00+01:00";

    const checkout = getCheckoutBillingOffer("annual", new Date("2026-06-05T12:00:00+01:00"));

    expect(checkout.planKey).toBe("annual");
    expect(checkout.variant).toBe("standard");
    expect(checkout.checkoutPriceId).toBe("price_annual");
    expect(checkout.checkoutCouponId).toBeNull();
  });

  it("keeps the founder recurring price live when the intro coupon is missing", () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY_PROMO = "price_launch";
    delete process.env.STRIPE_PROMO_COUPON_ID;
    process.env.STRIPE_PRICE_PRO_MONTHLY_STANDARD = "price_standard";
    process.env.STRIPE_PRICE_PRO_ANNUAL = "price_annual";
    process.env.STRIPE_PROMO_END_AT = "2026-06-06T00:00:00+01:00";

    const pricing = getPublicBillingPricing(new Date("2026-06-05T12:00:00+01:00"));
    const checkout = getCheckoutBillingOffer("monthly", new Date("2026-06-05T12:00:00+01:00"));

    expect(pricing.monthly.promotion).toMatchObject({
      badge: "Founder price",
      headline: "£20/month founder price",
      ctaLabel: "Claim founder price",
      compareAtHeadline: "£24.99/month",
    });
    expect(checkout.variant).toBe("launch");
    expect(checkout.checkoutPriceId).toBe("price_launch");
    expect(checkout.checkoutCouponId).toBeNull();
  });
});
