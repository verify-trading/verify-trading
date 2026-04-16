"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PublicBillingPricing } from "@/lib/billing/config";
import type { PricingPageBillingContext } from "@/lib/billing/pricing-page-data";
import { FREE_DAILY_ASK_LIMIT } from "@/lib/rate-limit/usage";
import { cn } from "@/lib/utils";

import { ProAnnualPlanCard, ProMonthlyPlanCard } from "./pro-plan-cards";

const surface =
  "rounded-xl border border-white/[0.08] bg-white/[0.02]";

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-coral)]/90">
      {children}
    </p>
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
            {`Free includes ${FREE_DAILY_ASK_LIMIT} Ask chats per day. Pro unlocks unlimited Ask and premium app features.`}
          </p>
        </div>
      )}

      <div className={cn("grid gap-4 lg:grid-cols-3", compactHeader ? "mt-5" : "mt-12")}>
        <div className={cn(surface, "flex flex-col p-6 transition-colors hover:border-white/[0.12]")}>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{pricing.free.badge}</span>
          <h3 className="mt-4 text-3xl font-bold tracking-tight text-white">{pricing.free.headline}</h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">{pricing.free.detail}</p>
          <ul className="mt-6 flex-1 space-y-2">
            {[
              `${FREE_DAILY_ASK_LIMIT} Ask chats per day`,
              "Broker verification",
              "Trade Analysis",
              "Risk Calculators",
            ].map((f) => (
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
                <Link href="/ask" prefetch={false}>
                  Open Ask
                </Link>
              </Button>
            )}
          </div>
        </div>

        <ProMonthlyPlanCard pricing={pricing} billingContext={billingContext} />
        <ProAnnualPlanCard pricing={pricing} billingContext={billingContext} />
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
