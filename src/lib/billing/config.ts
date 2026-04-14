export type BillingOfferVariant = "launch" | "standard";
export type BillingPlanKey = "monthly" | "annual";

type PublicBillingPlan = {
  badge: string;
  headline: string;
  detail: string;
};

type MonthlyBillingPromotion = {
  variant: Extract<BillingOfferVariant, "launch">;
  badge: string;
  headline: string;
  detail: string;
  priceHighlight: string;
  priceQualifier: string;
  followup: string;
  ctaLabel: string;
  compareAtHeadline: string;
};

export type PublicBillingPricing = {
  deadlineLabel: string;
  free: PublicBillingPlan;
  monthly: PublicBillingPlan & {
    ctaLabel: string;
    promotion: MonthlyBillingPromotion | null;
  };
  annual: PublicBillingPlan & {
    ctaLabel: string;
    equivalentMonthlyHeadline: string;
    savingsLabel: string;
  };
};

export type CheckoutBillingOffer = {
  planKey: BillingPlanKey;
  variant: BillingOfferVariant;
  badge: string;
  headline: string;
  detail: string;
  ctaLabel: string;
  checkoutPriceId: string;
  checkoutCouponId: string | null;
};

const DEFAULT_PROMO_END_AT = "2026-06-06T00:00:00+01:00";
const PROMO_DEADLINE_LABEL = "6 June 2026";
const STANDARD_MONTHLY_PRICE_GBP = 24.99;
const PROMO_MONTHLY_PRICE_GBP = 20;
const PROMO_INTRO_PRICE_GBP = 5;
const STANDARD_ANNUAL_PRICE_GBP = 200;

function readOptionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function readRequiredEnv(name: string): string {
  const value = readOptionalEnv(name);
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

function formatGbp(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatMonthlyHeadline(amount: number): string {
  return `${formatGbp(amount)}/month`;
}

function formatAnnualHeadline(amount: number): string {
  return `${formatGbp(amount)}/year`;
}

export function getBillingPromoEndAt(): Date {
  const raw = readOptionalEnv("STRIPE_PROMO_END_AT") ?? DEFAULT_PROMO_END_AT;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error("STRIPE_PROMO_END_AT must be a valid ISO-8601 date.");
  }
  return parsed;
}

export function isLaunchOfferActive(now = new Date()): boolean {
  return now.getTime() < getBillingPromoEndAt().getTime();
}

export function getPublicBillingPricing(now = new Date()): PublicBillingPricing {
  const launchActive = isLaunchOfferActive(now);
  const launchCouponId = readOptionalEnv("STRIPE_PROMO_COUPON_ID");
  const hasLaunchIntroDiscount = Boolean(launchCouponId);
  const standardMonthlyHeadline = formatMonthlyHeadline(STANDARD_MONTHLY_PRICE_GBP);
  const annualHeadline = formatAnnualHeadline(STANDARD_ANNUAL_PRICE_GBP);
  const annualSavings = STANDARD_MONTHLY_PRICE_GBP * 12 - STANDARD_ANNUAL_PRICE_GBP;
  const monthlyPromotion =
    launchActive
      ? hasLaunchIntroDiscount
        ? {
            variant: "launch" as const,
            badge: "Launch offer",
            headline: `First month ${formatGbp(PROMO_INTRO_PRICE_GBP)}, then ${formatMonthlyHeadline(PROMO_MONTHLY_PRICE_GBP)}`,
            detail: `Join before ${PROMO_DEADLINE_LABEL}. Your first month is ${formatGbp(PROMO_INTRO_PRICE_GBP)}, then ${formatMonthlyHeadline(PROMO_MONTHLY_PRICE_GBP)} while your subscription stays active.`,
            priceHighlight: formatGbp(PROMO_INTRO_PRICE_GBP),
            priceQualifier: "first month",
            followup: `Then ${formatMonthlyHeadline(PROMO_MONTHLY_PRICE_GBP)} while your subscription stays active`,
            ctaLabel: `Join for ${formatGbp(PROMO_INTRO_PRICE_GBP)}`,
            compareAtHeadline: standardMonthlyHeadline,
          }
        : {
            variant: "launch" as const,
            badge: "Founder price",
            headline: `${formatMonthlyHeadline(PROMO_MONTHLY_PRICE_GBP)} founder price`,
            detail: `Join before ${PROMO_DEADLINE_LABEL} to lock in ${formatMonthlyHeadline(PROMO_MONTHLY_PRICE_GBP)} before new signups move to ${standardMonthlyHeadline}.`,
            priceHighlight: formatGbp(PROMO_MONTHLY_PRICE_GBP),
            priceQualifier: "/month",
            followup: "Founding price locked while your subscription stays active",
            ctaLabel: "Claim founder price",
            compareAtHeadline: standardMonthlyHeadline,
          }
      : null;

  return {
    deadlineLabel: PROMO_DEADLINE_LABEL,
    free: {
      badge: "Free",
      headline: formatGbp(0),
      detail: "10 Ask chats per day with account sync and the standard app experience.",
    },
    monthly: {
      badge: "Most popular",
      headline: standardMonthlyHeadline,
      detail: "Unlimited Ask access plus premium app features.",
      ctaLabel: "Start Pro",
      promotion: monthlyPromotion,
    },
    annual: {
      badge: "Best value",
      headline: annualHeadline,
      detail: "Same Pro features as monthly, with one annual payment.",
      ctaLabel: "Start annual plan",
      equivalentMonthlyHeadline: `${formatGbp(STANDARD_ANNUAL_PRICE_GBP / 12)}/month equivalent`,
      savingsLabel: `Save ${formatGbp(annualSavings)} per year`,
    },
  };
}

export function getCheckoutBillingOffer(planKey: BillingPlanKey, now = new Date()): CheckoutBillingOffer {
  const pricing = getPublicBillingPricing(now);

  if (planKey === "annual") {
    return {
      planKey,
      variant: "standard",
      badge: pricing.annual.badge,
      headline: pricing.annual.headline,
      detail: pricing.annual.detail,
      ctaLabel: pricing.annual.ctaLabel,
      checkoutPriceId: readRequiredEnv("STRIPE_PRICE_PRO_ANNUAL"),
      checkoutCouponId: null,
    };
  }

  if (pricing.monthly.promotion) {
    return {
      planKey,
      variant: pricing.monthly.promotion.variant,
      badge: pricing.monthly.promotion.badge,
      headline: pricing.monthly.promotion.headline,
      detail: pricing.monthly.promotion.detail,
      ctaLabel: pricing.monthly.promotion.ctaLabel,
      checkoutPriceId: readRequiredEnv("STRIPE_PRICE_PRO_MONTHLY_PROMO"),
      checkoutCouponId: readOptionalEnv("STRIPE_PROMO_COUPON_ID"),
    };
  }

  return {
    planKey,
    variant: "standard",
    badge: pricing.monthly.badge,
    headline: pricing.monthly.headline,
    detail: pricing.monthly.detail,
    ctaLabel: pricing.monthly.ctaLabel,
    checkoutPriceId: readRequiredEnv("STRIPE_PRICE_PRO_MONTHLY_STANDARD"),
    checkoutCouponId: null,
  };
}

export function getStripeSecretKey(): string {
  return readRequiredEnv("STRIPE_SECRET_KEY");
}

export function getStripeWebhookSecret(): string {
  return readRequiredEnv("STRIPE_WEBHOOK_SECRET");
}

export function getStripePortalConfigurationId(): string | null {
  return readOptionalEnv("STRIPE_PORTAL_CONFIGURATION_ID");
}
