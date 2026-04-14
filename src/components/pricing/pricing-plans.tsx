"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";

import { BillingActionButton } from "@/components/billing/billing-actions";
import { Button } from "@/components/ui/button";
import type { BillingPlanKey, PublicBillingPricing } from "@/lib/billing/config";
import type { PricingPageBillingContext } from "@/lib/billing/pricing-page-data";
import { cn } from "@/lib/utils";

const surface =
  "rounded-xl border border-white/[0.08] bg-white/[0.02]";

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-coral)]/90">
      {children}
    </p>
  );
}

function renderPaidPlanAction({
  billingContext,
  checkoutPlan,
  isCurrentPlan,
  defaultLabel,
  variant,
}: {
  billingContext: PricingPageBillingContext | null | undefined;
  checkoutPlan: BillingPlanKey;
  isCurrentPlan: boolean;
  defaultLabel: React.ReactNode;
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

/**
 * Full Free / Pro monthly / Pro annual grid. Used on `/pricing` and the landing page.
 * Use `compactHeader` on `/pricing` to avoid repeating copy the cards already show.
 */
export function PricingPlansSection({
  pricing,
  billingContext,
  compactHeader = false,
  showBackHome = false,
}: {
  pricing: PublicBillingPricing;
  billingContext?: PricingPageBillingContext | null;
  /** One-line title, no intro paragraph (dedicated pricing page). */
  compactHeader?: boolean;
  /** Compact page only: Home link above the title; keeps spacing tight. */
  showBackHome?: boolean;
}) {
  const monthlyPromotion = pricing.monthly.promotion;
  const currentPlanKey = billingContext?.currentPlanKey ?? null;
  const isOnMonthlyPlan = currentPlanKey === "monthly";
  const isOnAnnualPlan = currentPlanKey === "annual";

  return (
    <section
      className={cn(
        "mx-auto w-full max-w-6xl px-4 sm:px-6",
        compactHeader ? "pb-8 pt-3 sm:pb-12 sm:pt-4" : "py-16 sm:py-24",
      )}
    >
      {compactHeader && showBackHome ? (
        <Link
          href="/"
          className="mb-3 inline-flex items-center gap-2 text-sm text-white/50 transition hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Home
        </Link>
      ) : null}
      {compactHeader ? (
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-white sm:text-3xl">Pricing</h1>
      ) : (
        <div className="max-w-2xl">
          <SectionEyebrow>Pricing</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
            Free to start. Pro when you need more.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-400">
            Free includes 10 Ask chats per day. Pro unlocks unlimited Ask and premium app features.
          </p>
        </div>
      )}

      <div className={cn("grid gap-4 lg:grid-cols-3", compactHeader ? "mt-5" : "mt-12")}>
        <div className={cn(surface, "flex flex-col p-6 transition-colors hover:border-white/[0.12]")}>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{pricing.free.badge}</span>
          <h3 className="mt-4 text-3xl font-bold tracking-tight text-white">{pricing.free.headline}</h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">{pricing.free.detail}</p>
          <ul className="mt-6 flex-1 space-y-2">
            {["10 Ask chats per day", "Broker verification", "Account sync", "Standard app experience"].map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                <CheckCircle2 className="size-4 shrink-0 text-[var(--vt-green)]" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-6">
            {!billingContext?.isSignedIn ? (
              <Button asChild variant="outline" size="pill" className="w-full">
                <Link href="/signup">Create free account</Link>
              </Button>
            ) : (
              <Button asChild variant="outline" size="pill" className="w-full">
                <Link href="/ask">Open Ask</Link>
              </Button>
            )}
          </div>
        </div>

        <div
          className={cn(
            surface,
            "flex flex-col border-[var(--vt-coral)]/40 bg-gradient-to-b from-[rgba(242,109,109,0.06)] to-transparent p-6 ring-1 ring-[var(--vt-coral)]/25",
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
            {["Unlimited Ask", "Live market dashboard", "Premium calculators", "Priority support", "Future features"].map((f) => (
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

        <div className={cn(surface, "flex flex-col p-6 transition-colors hover:border-white/[0.12]")}>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{pricing.annual.badge}</span>
          <h3 className="mt-4 text-3xl font-bold tracking-tight text-white">{pricing.annual.headline}</h3>
          <p className="mt-2 text-sm font-medium text-[var(--vt-green)]">{pricing.annual.savingsLabel}</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">{pricing.annual.detail}</p>
          <p className="mt-2 text-sm text-[var(--vt-blue)]">{pricing.annual.equivalentMonthlyHeadline}</p>

          <ul className="mt-6 flex-1 space-y-2">
            {["Everything in Pro", "Annual discount", "Best long-term value"].map((f) => (
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
      </div>

      {billingContext?.hasManageableSubscription ? (
        <p className="mt-6 text-left text-xs leading-relaxed text-slate-500">
          Use the paid plan cards to change plans in Stripe. Payment methods, invoices, and subscription updates sync
          back to the app automatically.
        </p>
      ) : null}

      {monthlyPromotion ? (
        <p className="mt-6 text-left text-xs leading-relaxed text-slate-500">
          Monthly offer ends {pricing.deadlineLabel}. After that, Pro Monthly returns to the standard list price.
        </p>
      ) : null}
    </section>
  );
}
