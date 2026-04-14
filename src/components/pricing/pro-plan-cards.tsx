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

export function ProMonthlyPlanCard({
  pricing,
  billingContext,
  className,
  density = "default",
}: {
  pricing: PublicBillingPricing;
  billingContext: PricingPageBillingContext | null | undefined;
  className?: string;
  /** `compact` — tighter padding/type for overlays (e.g. Markets paywall). */
  density?: "default" | "compact";
}) {
  const monthlyPromotion = pricing.monthly.promotion;
  const currentPlanKey = billingContext?.currentPlanKey ?? null;
  const isOnMonthlyPlan = currentPlanKey === "monthly";
  const compact = density === "compact";

  return (
    <div
      className={cn(
        surface,
        "flex flex-col border-[var(--vt-coral)]/40 bg-gradient-to-b from-[rgba(242,109,109,0.06)] to-transparent ring-1 ring-[var(--vt-coral)]/25",
        compact ? "p-4 sm:p-5" : "p-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--vt-coral)]">
          {monthlyPromotion ? monthlyPromotion.badge : "Most popular"}
        </span>
        {monthlyPromotion ? (
          <span className="rounded bg-[var(--vt-coral)]/90 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
            Offer
          </span>
        ) : null}
      </div>

      <div className={cn("flex flex-wrap items-baseline gap-2", compact ? "mt-3" : "mt-4")}>
        <h3 className={cn("font-bold tracking-tight text-white", compact ? "text-2xl sm:text-3xl" : "text-3xl")}>
          {monthlyPromotion ? monthlyPromotion.priceHighlight : pricing.monthly.headline}
        </h3>
        {monthlyPromotion ? (
          <span className={cn("font-medium text-[var(--vt-coral)]", compact ? "text-xs sm:text-sm" : "text-sm")}>
            {monthlyPromotion.priceQualifier}
          </span>
        ) : null}
      </div>
      {monthlyPromotion ? (
        <p className={cn("text-slate-500 line-through", compact ? "mt-0.5 text-xs sm:text-sm" : "mt-1 text-sm")}>
          {pricing.monthly.headline}
        </p>
      ) : null}
      <p
        className={cn(
          "leading-relaxed text-slate-400",
          compact ? "mt-2 text-xs sm:text-sm" : "mt-3 text-sm",
        )}
      >
        {monthlyPromotion ? monthlyPromotion.detail : pricing.monthly.detail}
      </p>

      <ul className={cn("flex-1", compact ? "mt-4 space-y-1.5" : "mt-6 space-y-2")}>
        {PRO_PLAN_FEATURES.map((f) => (
          <li
            key={f}
            className={cn(
              "flex items-center gap-2 text-slate-200",
              compact ? "text-xs sm:text-sm" : "text-sm",
            )}
          >
            <CheckCircle2
              className={cn("shrink-0 text-[var(--vt-green)]", compact ? "size-3.5" : "size-4")}
              aria-hidden
            />
            {f}
          </li>
        ))}
      </ul>
      <div className={compact ? "mt-4" : "mt-6"}>
        {renderPaidPlanAction({
          billingContext,
          checkoutPlan: "monthly",
          isCurrentPlan: isOnMonthlyPlan,
          variant: "default",
          defaultLabel: (
            <span className="inline-flex items-center gap-2">
              {monthlyPromotion ? monthlyPromotion.ctaLabel : "Start Pro"}
              <ArrowRight className={cn(compact ? "size-3.5" : "size-4")} aria-hidden />
            </span>
          ),
        })}
      </div>
    </div>
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
  const isOnAnnualPlan = currentPlanKey === "annual";
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
        {ANNUAL_PLAN_FEATURES.map((f) => (
          <li
            key={f}
            className={cn(
              "flex items-center gap-2 text-slate-300",
              compact ? "text-xs sm:text-sm" : "text-sm",
            )}
          >
            <CheckCircle2
              className={cn("shrink-0 text-[var(--vt-green)]", compact ? "size-3.5" : "size-4")}
              aria-hidden
            />
            {f}
          </li>
        ))}
      </ul>
      <div className={compact ? "mt-4" : "mt-6"}>
        {renderPaidPlanAction({
          billingContext,
          checkoutPlan: "annual",
          isCurrentPlan: isOnAnnualPlan,
          variant: "outline",
          defaultLabel: (
            <span className="inline-flex items-center gap-2">
              Start annual plan
              <ArrowRight className={cn(compact ? "size-3.5" : "size-4")} aria-hidden />
            </span>
          ),
        })}
      </div>
    </div>
  );
}
