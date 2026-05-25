"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { BillingActionButton } from "@/components/billing/billing-actions";
import { Button } from "@/components/ui/button";
import type { BillingPlanKey, PublicBillingPricing } from "@/lib/billing/config";
import type { PricingPageBillingContext } from "@/lib/billing/pricing-page-data";
import { ANNUAL_PLAN_FEATURES } from "@/lib/marketing/annual-plan-features";
import { PRO_PLAN_FEATURES } from "@/lib/marketing/pro-plan-features";
import { cn } from "@/lib/utils";

const surface = "rounded-xl border border-white/[0.08] bg-white/[0.02]";

export function renderPaidPlanAction({
  billingContext,
  checkoutPlan,
  isCurrentPlan,
  defaultLabel,
  variant,
}: {
  billingContext: PricingPageBillingContext | null | undefined;
  checkoutPlan: BillingPlanKey;
  isCurrentPlan: boolean;
  defaultLabel: ReactNode;
  variant: "default" | "outline";
}) {
  if (!billingContext?.isSignedIn) {
    return (
      <Button asChild variant={variant} size="pill" className="w-full">
        <Link href="/signup">{defaultLabel}</Link>
      </Button>
    );
  }

  if (!billingContext.hasManageableSubscription) {
    return (
      <BillingActionButton
        action="checkout"
        buttonVariant={variant}
        buttonSize="pill"
        className="w-full gap-2"
        payload={{ plan: checkoutPlan }}
      >
        {defaultLabel}
      </BillingActionButton>
    );
  }

  if (isCurrentPlan) {
    return (
      <Button type="button" variant={variant} size="pill" className="w-full" disabled>
        Current plan
      </Button>
    );
  }

  if (billingContext.currentPlanKey) {
    return (
      <BillingActionButton
        action="portal"
        buttonVariant={variant}
        buttonSize="pill"
        className="w-full gap-2"
        payload={{ flow: "subscription_update" }}
      >
        Change plan in Stripe
      </BillingActionButton>
    );
  }

  return (
    <Button asChild variant={variant} size="pill" className="w-full">
      <Link href="/billing">Manage subscription</Link>
    </Button>
  );
}

function PaidPlanCardShell({
  badge,
  badgeClassName,
  headline,
  dailyEquivalentHeadline,
  detail,
  features,
  billingContext,
  checkoutPlan,
  isCurrentPlan,
  ctaLabel,
  variant,
  className,
  density = "default",
  highlighted = false,
}: {
  badge: string;
  badgeClassName?: string;
  headline: string;
  dailyEquivalentHeadline: string;
  detail: string;
  features: readonly string[];
  billingContext: PricingPageBillingContext | null | undefined;
  checkoutPlan: BillingPlanKey;
  isCurrentPlan: boolean;
  ctaLabel: string;
  variant: "default" | "outline";
  className?: string;
  density?: "default" | "compact";
  highlighted?: boolean;
}) {
  const compact = density === "compact";

  return (
    <div
      className={cn(
        surface,
        "flex flex-col transition-colors hover:border-white/[0.12]",
        highlighted &&
          "border-[var(--vt-coral)]/40 bg-gradient-to-b from-[rgba(242,109,109,0.06)] to-transparent ring-1 ring-[var(--vt-coral)]/25",
        compact ? "p-4 sm:p-5" : "p-6",
        className,
      )}
    >
      <span
        className={cn(
          "text-xs font-semibold uppercase tracking-wider",
          badgeClassName ?? "text-slate-500",
        )}
      >
        {badge}
      </span>
      <h3 className={cn("font-bold tracking-tight text-white", compact ? "mt-3 text-2xl sm:text-3xl" : "mt-4 text-3xl")}>
        {headline}
      </h3>
      <p className={cn("font-medium text-[var(--vt-blue)]", compact ? "mt-1 text-xs sm:text-sm" : "mt-1.5 text-sm")}>
        {dailyEquivalentHeadline}
      </p>
      <p
        className={cn(
          "leading-relaxed text-slate-400",
          compact ? "mt-2 text-xs sm:text-sm" : "mt-3 text-sm",
        )}
      >
        {detail}
      </p>

      <ul className={cn("flex-1", compact ? "mt-4 space-y-1.5" : "mt-6 space-y-2")}>
        {features.map((feature) => (
          <li
            key={feature}
            className={cn(
              "flex items-center gap-2 text-slate-200",
              compact ? "text-xs sm:text-sm" : "text-sm",
            )}
          >
            <CheckCircle2
              className={cn("shrink-0 text-[var(--vt-green)]", compact ? "size-3.5" : "size-4")}
              aria-hidden
            />
            {feature}
          </li>
        ))}
      </ul>
      <div className={compact ? "mt-4" : "mt-6"}>
        {renderPaidPlanAction({
          billingContext,
          checkoutPlan,
          isCurrentPlan,
          variant,
          defaultLabel: (
            <span className="inline-flex items-center gap-2">
              {ctaLabel}
              <ArrowRight className={cn(compact ? "size-3.5" : "size-4")} aria-hidden />
            </span>
          ),
        })}
      </div>
    </div>
  );
}

export function ProWeeklyPlanCard({
  pricing,
  billingContext,
  className,
  density = "default",
}: {
  pricing: PublicBillingPricing;
  billingContext: PricingPageBillingContext | null | undefined;
  className?: string;
  density?: "default" | "compact";
}) {
  const currentPlanKey = billingContext?.currentPlanKey ?? null;

  return (
    <PaidPlanCardShell
      badge={pricing.weekly.badge}
      headline={pricing.weekly.headline}
      dailyEquivalentHeadline={pricing.weekly.dailyEquivalentHeadline}
      detail={pricing.weekly.detail}
      features={PRO_PLAN_FEATURES}
      billingContext={billingContext}
      checkoutPlan="weekly"
      isCurrentPlan={currentPlanKey === "weekly"}
      ctaLabel={pricing.weekly.ctaLabel}
      variant="outline"
      className={className}
      density={density}
    />
  );
}

export function ProMonthlyPlanCard({
  pricing,
  billingContext,
  className,
  density = "default",
}: {
  pricing: PublicBillingPricing;
  billingContext: PricingPageBillingContext | null | undefined;
  className?: string;
  density?: "default" | "compact";
}) {
  const currentPlanKey = billingContext?.currentPlanKey ?? null;

  return (
    <PaidPlanCardShell
      badge={pricing.monthly.badge}
      badgeClassName="text-[var(--vt-coral)]"
      headline={pricing.monthly.headline}
      dailyEquivalentHeadline={pricing.monthly.dailyEquivalentHeadline}
      detail={pricing.monthly.detail}
      features={PRO_PLAN_FEATURES}
      billingContext={billingContext}
      checkoutPlan="monthly"
      isCurrentPlan={currentPlanKey === "monthly"}
      ctaLabel={pricing.monthly.ctaLabel}
      variant="default"
      className={className}
      density={density}
      highlighted
    />
  );
}

export function ProAnnualPlanCard({
  pricing,
  billingContext,
  className,
  density = "default",
}: {
  pricing: PublicBillingPricing;
  billingContext: PricingPageBillingContext | null | undefined;
  className?: string;
  density?: "default" | "compact";
}) {
  const currentPlanKey = billingContext?.currentPlanKey ?? null;
  const compact = density === "compact";

  return (
    <div
      className={cn(
        surface,
        "flex flex-col transition-colors hover:border-white/[0.12]",
        compact ? "p-4 sm:p-5" : "p-6",
        className,
      )}
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{pricing.annual.badge}</span>
      <h3 className={cn("font-bold tracking-tight text-white", compact ? "mt-3 text-2xl sm:text-3xl" : "mt-4 text-3xl")}>
        {pricing.annual.headline}
      </h3>
      <p className={cn("font-medium text-[var(--vt-blue)]", compact ? "mt-1 text-xs sm:text-sm" : "mt-1.5 text-sm")}>
        {pricing.annual.dailyEquivalentHeadline}
      </p>
      <p className={cn("font-medium text-[var(--vt-green)]", compact ? "mt-1.5 text-xs sm:text-sm" : "mt-2 text-sm")}>
        {pricing.annual.savingsLabel}
      </p>
      <p
        className={cn(
          "leading-relaxed text-slate-400",
          compact ? "mt-2 text-xs sm:text-sm" : "mt-3 text-sm",
        )}
      >
        {pricing.annual.detail}
      </p>
      <p className={cn("text-[var(--vt-blue)]", compact ? "mt-1.5 text-xs sm:text-sm" : "mt-2 text-sm")}>
        {pricing.annual.equivalentMonthlyHeadline}
      </p>

      <ul className={cn("flex-1", compact ? "mt-4 space-y-1.5" : "mt-6 space-y-2")}>
        {ANNUAL_PLAN_FEATURES.map((feature) => (
          <li
            key={feature}
            className={cn(
              "flex items-center gap-2 text-slate-300",
              compact ? "text-xs sm:text-sm" : "text-sm",
            )}
          >
            <CheckCircle2
              className={cn("shrink-0 text-[var(--vt-green)]", compact ? "size-3.5" : "size-4")}
              aria-hidden
            />
            {feature}
          </li>
        ))}
      </ul>
      <div className={compact ? "mt-4" : "mt-6"}>
        {renderPaidPlanAction({
          billingContext,
          checkoutPlan: "annual",
          isCurrentPlan: currentPlanKey === "annual",
          variant: "outline",
          defaultLabel: (
            <span className="inline-flex items-center gap-2">
              {pricing.annual.ctaLabel}
              <ArrowRight className={cn(compact ? "size-3.5" : "size-4")} aria-hidden />
            </span>
          ),
        })}
      </div>
    </div>
  );
}
