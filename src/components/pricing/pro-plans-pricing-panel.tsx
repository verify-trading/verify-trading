"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

import type { PublicBillingPricing } from "@/lib/billing/config";
import type { PricingPageBillingContext } from "@/lib/billing/pricing-page-data";

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
}: {
  pricing: PublicBillingPricing;
  billingContext: PricingPageBillingContext | null;
  headline: string;
  subtext?: string;
}) {
  return (
    <div className="w-full max-w-3xl">
      <div className="mb-5 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-[rgba(76,110,245,0.3)] bg-gradient-to-br from-[rgba(76,110,245,0.15)] to-transparent text-white shadow-[0_8px_24px_rgba(76,110,245,0.15)]">
          <Lock className="size-6" strokeWidth={2} aria-hidden />
        </div>
        <h3 className="mt-4 text-lg font-semibold leading-snug tracking-tight text-white sm:text-xl">{headline}</h3>
        {subtext ? (
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">{subtext}</p>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <ProMonthlyPlanCard pricing={pricing} billingContext={billingContext} />
        <ProAnnualPlanCard pricing={pricing} billingContext={billingContext} />
      </div>
      <p className="mt-5 text-center text-xs text-slate-500">
        <Link href="/pricing" className="font-medium text-[var(--vt-blue)] underline-offset-2 hover:underline">
          View full pricing
        </Link>
      </p>
    </div>
  );
}
