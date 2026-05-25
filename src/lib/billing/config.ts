import { FREE_DAILY_ASK_LIMIT, PRO_DAILY_ASK_LIMIT } from "@/lib/rate-limit/usage";

export type BillingPlanKey = "weekly" | "monthly" | "annual";

type PublicBillingPlan = {
  badge: string;
  headline: string;
  detail: string;
  dailyEquivalentHeadline: string;
};

export type PublicBillingPricing = {
  free: Omit<PublicBillingPlan, "dailyEquivalentHeadline"> & {
    dailyEquivalentHeadline?: never;
  };
  weekly: PublicBillingPlan & {
    ctaLabel: string;
  };
  monthly: PublicBillingPlan & {
    ctaLabel: string;
  };
  annual: PublicBillingPlan & {
    ctaLabel: string;
    equivalentMonthlyHeadline: string;
    savingsLabel: string;
  };
};

export type CheckoutBillingOffer = {
  planKey: BillingPlanKey;
  badge: string;
  headline: string;
  detail: string;
  ctaLabel: string;
  checkoutPriceId: string;
};

const WEEKLY_PRICE_GBP = 6.99;
const MONTHLY_PRICE_GBP = 19.99;
const ANNUAL_PRICE_GBP = 119.99;

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

function formatWeeklyHeadline(amount: number): string {
  return `${formatGbp(amount)}/week`;
}

function formatMonthlyHeadline(amount: number): string {
  return `${formatGbp(amount)}/month`;
}

function formatAnnualHeadline(amount: number): string {
  return `${formatGbp(amount)}/year`;
}

function formatDailyEquivalentHeadline(amountGbp: number, days: number): string {
  const rawPence = (amountGbp / days) * 100;
  const pence = days >= 365 ? Math.round(rawPence) : Math.floor(rawPence + 1e-9);
  if (pence >= 100) {
    return `${formatGbp(pence / 100)} per day`;
  }

  return `${pence}p per day`;
}

function readStripePriceProMonthly(): string {
  return readOptionalEnv("STRIPE_PRICE_PRO_MONTHLY") ?? readRequiredEnv("STRIPE_PRICE_PRO_MONTHLY_STANDARD");
}

export function getPublicBillingPricing(): PublicBillingPricing {
  const weeklyHeadline = formatWeeklyHeadline(WEEKLY_PRICE_GBP);
  const monthlyHeadline = formatMonthlyHeadline(MONTHLY_PRICE_GBP);
  const annualHeadline = formatAnnualHeadline(ANNUAL_PRICE_GBP);
  const annualSavings = MONTHLY_PRICE_GBP * 12 - ANNUAL_PRICE_GBP;

  return {
    free: {
      badge: "Free",
      headline: formatGbp(0),
      detail: `${FREE_DAILY_ASK_LIMIT} Ask chats per day with broker verification, trade analysis, and risk calculators.`,
    },
    weekly: {
      badge: "Flexible",
      headline: weeklyHeadline,
      detail: "Full Pro access billed weekly.",
      dailyEquivalentHeadline: formatDailyEquivalentHeadline(WEEKLY_PRICE_GBP, 7),
      ctaLabel: "Start weekly plan",
    },
    monthly: {
      badge: "Most popular",
      headline: monthlyHeadline,
      detail: `${PRO_DAILY_ASK_LIMIT} Ask chats per day plus premium app features.`,
      dailyEquivalentHeadline: formatDailyEquivalentHeadline(MONTHLY_PRICE_GBP, 30),
      ctaLabel: "Start Pro",
    },
    annual: {
      badge: "Best value",
      headline: annualHeadline,
      detail: "Same Pro features as monthly, with one annual payment.",
      dailyEquivalentHeadline: formatDailyEquivalentHeadline(ANNUAL_PRICE_GBP, 365),
      ctaLabel: "Start annual plan",
      equivalentMonthlyHeadline: `${formatGbp(ANNUAL_PRICE_GBP / 12)}/month equivalent`,
      savingsLabel: `Save ${formatGbp(annualSavings)} per year (6 months free)`,
    },
  };
}

export function getCheckoutBillingOffer(planKey: BillingPlanKey): CheckoutBillingOffer {
  const pricing = getPublicBillingPricing();

  if (planKey === "weekly") {
    return {
      planKey,
      badge: pricing.weekly.badge,
      headline: pricing.weekly.headline,
      detail: pricing.weekly.detail,
      ctaLabel: pricing.weekly.ctaLabel,
      checkoutPriceId: readRequiredEnv("STRIPE_PRICE_PRO_WEEKLY"),
    };
  }

  if (planKey === "annual") {
    return {
      planKey,
      badge: pricing.annual.badge,
      headline: pricing.annual.headline,
      detail: pricing.annual.detail,
      ctaLabel: pricing.annual.ctaLabel,
      checkoutPriceId: readRequiredEnv("STRIPE_PRICE_PRO_ANNUAL"),
    };
  }

  return {
    planKey: "monthly",
    badge: pricing.monthly.badge,
    headline: pricing.monthly.headline,
    detail: pricing.monthly.detail,
    ctaLabel: pricing.monthly.ctaLabel,
    checkoutPriceId: readStripePriceProMonthly(),
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

export function formatBillingPlanLabel(planKey: BillingPlanKey): string {
  switch (planKey) {
    case "weekly":
      return "Pro Weekly";
    case "monthly":
      return "Pro Monthly";
    case "annual":
      return "Pro Annual";
    default:
      return "Pro";
  }
}

const STRIPE_INTERVAL_TO_PLAN_KEY: Record<string, BillingPlanKey> = {
  week: "weekly",
  month: "monthly",
  year: "annual",
};

export function readBillingPlanKeyFromStripeInterval(interval: string | null | undefined): BillingPlanKey | null {
  if (!interval) {
    return null;
  }

  return STRIPE_INTERVAL_TO_PLAN_KEY[interval] ?? null;
}
