import { afterEach, describe, expect, it } from "vitest";

import {
  getCheckoutBillingOffer,
  getPublicBillingPricing,
  readBillingPlanKeyFromStripeInterval,
} from "@/lib/billing/config";

const ORIGINAL_ENV = {
  STRIPE_PRICE_PRO_WEEKLY: process.env.STRIPE_PRICE_PRO_WEEKLY,
  STRIPE_PRICE_PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY,
  STRIPE_PRICE_PRO_MONTHLY_STANDARD: process.env.STRIPE_PRICE_PRO_MONTHLY_STANDARD,
  STRIPE_PRICE_PRO_ANNUAL: process.env.STRIPE_PRICE_PRO_ANNUAL,
};

afterEach(() => {
  process.env.STRIPE_PRICE_PRO_WEEKLY = ORIGINAL_ENV.STRIPE_PRICE_PRO_WEEKLY;
  process.env.STRIPE_PRICE_PRO_MONTHLY = ORIGINAL_ENV.STRIPE_PRICE_PRO_MONTHLY;
  process.env.STRIPE_PRICE_PRO_MONTHLY_STANDARD = ORIGINAL_ENV.STRIPE_PRICE_PRO_MONTHLY_STANDARD;
  process.env.STRIPE_PRICE_PRO_ANNUAL = ORIGINAL_ENV.STRIPE_PRICE_PRO_ANNUAL;
});

function setBillingEnv() {
  process.env.STRIPE_PRICE_PRO_WEEKLY = "price_weekly";
  process.env.STRIPE_PRICE_PRO_MONTHLY = "price_monthly";
  process.env.STRIPE_PRICE_PRO_ANNUAL = "price_annual";
}

describe("billing config", () => {
  it("exposes the new public pricing tiers", () => {
    setBillingEnv();

    const pricing = getPublicBillingPricing();

    expect(pricing.free.headline).toBe("£0");
    expect(pricing.weekly.headline).toBe("£6.99/week");
    expect(pricing.weekly.dailyEquivalentHeadline).toBe("99p per day");
    expect(pricing.monthly.headline).toBe("£19.99/month");
    expect(pricing.monthly.dailyEquivalentHeadline).toBe("66p per day");
    expect(pricing.annual.headline).toBe("£119.99/year");
    expect(pricing.annual.dailyEquivalentHeadline).toBe("33p per day");
    expect(pricing.annual.savingsLabel).toBe("Save £119.89 per year (6 months free)");
  });

  it("maps checkout plans to Stripe price ids", () => {
    setBillingEnv();

    expect(getCheckoutBillingOffer("weekly").checkoutPriceId).toBe("price_weekly");
    expect(getCheckoutBillingOffer("monthly").checkoutPriceId).toBe("price_monthly");
    expect(getCheckoutBillingOffer("annual").checkoutPriceId).toBe("price_annual");
  });

  it("falls back to the legacy monthly price env var", () => {
    process.env.STRIPE_PRICE_PRO_WEEKLY = "price_weekly";
    delete process.env.STRIPE_PRICE_PRO_MONTHLY;
    process.env.STRIPE_PRICE_PRO_MONTHLY_STANDARD = "price_monthly_legacy";
    process.env.STRIPE_PRICE_PRO_ANNUAL = "price_annual";

    expect(getCheckoutBillingOffer("monthly").checkoutPriceId).toBe("price_monthly_legacy");
  });

  it("maps Stripe intervals to billing plan keys", () => {
    expect(readBillingPlanKeyFromStripeInterval("week")).toBe("weekly");
    expect(readBillingPlanKeyFromStripeInterval("month")).toBe("monthly");
    expect(readBillingPlanKeyFromStripeInterval("year")).toBe("annual");
    expect(readBillingPlanKeyFromStripeInterval("day")).toBeNull();
  });
});
