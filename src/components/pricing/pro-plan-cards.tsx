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
}: {
  pricing: PublicBillingPricing;
  billingContext: PricingPageBillingContext | null | undefined;
  className?: string;
}) {
  const monthlyPromotion = pricing.monthly.promotion;
  const currentPlanKey = billingContext?.currentPlanKey ?? null;
  const isOnMonthlyPlan = currentPlanKey === "monthly";

  return (
    <div
      className={cn(
        surface,
        "flex flex-col border-[var(--vt-coral)]/40 bg-gradient-to-b from-[rgba(242,109,109,0.06)] to-transparent p-6 ring-1 ring-[var(--vt-coral)]/25",
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

      <div className="mt-4 flex flex-wrap items-baseline gap-2">
        <h3 className="text-3xl font-bold tracking-tight text-white">
          {monthlyPromotion ? monthlyPromotion.priceHighlight : pricing.monthly.headline}
        </h3>
        {monthlyPromotion ? (
          <span className="text-sm font-medium text-[var(--vt-coral)]">{monthlyPromotion.priceQualifier}</span>
        ) : null}
      </div>
      {monthlyPromotion ? <p className="mt-1 text-sm text-slate-500 line-through">{pricing.monthly.headline}</p> : null}
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        {monthlyPromotion ? monthlyPromotion.detail : pricing.monthly.detail}
      </p>

      <ul className="mt-6 flex-1 space-y-2">
        {PRO_PLAN_FEATURES.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-slate-200">
            <CheckCircle2 className="size-4 shrink-0 text-[var(--vt-green)]" aria-hidden />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-6">
        {renderPaidPlanAction({
          billingContext,
          checkoutPlan: "monthly",
          isCurrentPlan: isOnMonthlyPlan,
          variant: "default",
          defaultLabel: (
            <span className="inline-flex items-center gap-2">
              {monthlyPromotion ? monthlyPromotion.ctaLabel : "Start Pro"}
              <ArrowRight className="size-4" aria-hidden />
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
}: {
  pricing: PublicBillingPricing;
  billingContext: PricingPageBillingContext | null | undefined;
  className?: string;
}) {
  const currentPlanKey = billingContext?.currentPlanKey ?? null;
  const isOnAnnualPlan = currentPlanKey === "annual";

  return (
    <div className={cn(surface, "flex flex-col p-6 transition-colors hover:border-white/[0.12]", className)}>
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{pricing.annual.badge}</span>
      <h3 className="mt-4 text-3xl font-bold tracking-tight text-white">{pricing.annual.headline}</h3>
      <p className="mt-2 text-sm font-medium text-[var(--vt-green)]">{pricing.annual.savingsLabel}</p>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">{pricing.annual.detail}</p>
      <p className="mt-2 text-sm text-[var(--vt-blue)]">{pricing.annual.equivalentMonthlyHeadline}</p>

      <ul className="mt-6 flex-1 space-y-2">
        {ANNUAL_PLAN_FEATURES.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
            <CheckCircle2 className="size-4 shrink-0 text-[var(--vt-green)]" aria-hidden />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-6">
        {renderPaidPlanAction({
          billingContext,
          checkoutPlan: "annual",
          isCurrentPlan: isOnAnnualPlan,
          variant: "outline",
          defaultLabel: (
            <span className="inline-flex items-center gap-2">
              Start annual plan
              <ArrowRight className="size-4" aria-hidden />
            </span>
          ),
        })}
      </div>
    </div>
  );
}
