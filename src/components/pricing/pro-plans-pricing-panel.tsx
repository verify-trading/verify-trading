"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

import type { PublicBillingPricing } from "@/lib/billing/config";
import type { PricingPageBillingContext } from "@/lib/billing/pricing-page-data";

import { cn } from "@/lib/utils";

import { ProAnnualPlanCard, ProMonthlyPlanCard } from "./pro-plan-cards";

/**
 * Reusable Pro monthly + annual cards with a short header — e.g. Markets paywall overlay.
 * Uses the same plan cards as the landing / pricing page.
 */
export function ProPlansPricingPanel({
  pricing,
  billingContext,
  headline,
  subtext,
  density = "default",
}: {
  pricing: PublicBillingPricing;
  billingContext: PricingPageBillingContext | null;
  headline: string;
  subtext?: string;
  /** `compact` — smaller type/spacing; two columns from `lg` (better on phones / small tablets). */
  density?: "default" | "compact";
}) {
  const compact = density === "compact";

  return (
    <div className={cn("w-full", compact ? "max-w-none" : "max-w-3xl")}>
      <div className={cn("text-center", compact ? "mb-3 sm:mb-4" : "mb-5")}>
        <div
          className={cn(
            "mx-auto flex items-center justify-center rounded-2xl border border-[rgba(76,110,245,0.3)] bg-gradient-to-br from-[rgba(76,110,245,0.15)] to-transparent text-white shadow-[0_8px_24px_rgba(76,110,245,0.15)]",
            compact ? "size-10 sm:size-11" : "size-12",
          )}
        >
          <Lock className={compact ? "size-5 sm:size-[1.35rem]" : "size-6"} strokeWidth={2} aria-hidden />
        </div>
        <h3
          className={cn(
            "font-semibold leading-snug tracking-tight text-white",
            compact ? "mt-3 text-base sm:text-lg" : "mt-4 text-lg sm:text-xl",
          )}
        >
          {headline}
        </h3>
        {subtext ? (
          <p
            className={cn(
              "mx-auto leading-relaxed text-slate-400",
              compact ? "mt-1.5 max-w-sm text-xs sm:text-sm" : "mt-2 max-w-md text-sm",
            )}
          >
            {subtext}
          </p>
        ) : null}
      </div>
      <div
        className={cn(
          "grid",
          compact ? "gap-2 sm:gap-3 lg:grid-cols-2" : "gap-3 md:grid-cols-2",
        )}
      >
        <ProMonthlyPlanCard pricing={pricing} billingContext={billingContext} density={density} />
        <ProAnnualPlanCard pricing={pricing} billingContext={billingContext} density={density} />
      </div>
      <p className={cn("text-center text-slate-500", compact ? "mt-3 text-[11px] sm:text-xs" : "mt-5 text-xs")}>
        <Link href="/pricing" className="font-medium text-[var(--vt-blue)] underline-offset-2 hover:underline">
          View full pricing
        </Link>
      </p>
    </div>
  );
}
