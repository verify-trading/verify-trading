"use client";

import Link from "next/link";
import { ArrowRight, Check, Lock, RefreshCcw, Sparkles } from "lucide-react";
import { useState } from "react";

import { APP_ICONS, type AppIconKey } from "@/components/icons/app-icons";
import { SectionEyebrow } from "@/components/landing/section-primitives";
import { Button } from "@/components/ui/button";
import type { BillingPlanKey, PublicBillingPricing } from "@/lib/billing/config";
import type { PricingPageBillingContext } from "@/lib/billing/pricing-page-data";
import { FREE_DAILY_ASK_LIMIT, PRO_DAILY_ASK_LIMIT } from "@/lib/rate-limit/usage";
import { cn } from "@/lib/utils";

import { PaidPlanAction } from "./pro-plan-cards";

const PLANS: Array<{ key: BillingPlanKey; label: string }> = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "annual", label: "Annual" },
];

const FREE_FEATURES = [
  `${FREE_DAILY_ASK_LIMIT} Ask chats a day`,
  "Broker and prop firm checks",
  "Live market prices",
  "Trade analysis",
  "Risk calculators",
];

const PRO_FEATURES = [
  `${PRO_DAILY_ASK_LIMIT} Ask chats a day`,
  "Daily Intelligence brief",
  "Economic calendar and event alerts",
  "Journal with Challenge Mode",
  "Mind psychology coaching",
  "Members-only community",
  "Priority support",
];

/** "£19.99/month" → ["£19.99", "/month"] so the amount can be set large. */
function splitPrice(headline: string): [string, string] {
  const i = headline.indexOf("/");
  return i === -1 ? [headline, ""] : [headline.slice(0, i), headline.slice(i)];
}

const card = "relative flex flex-col rounded-3xl p-6 sm:p-8";

/**
 * Pricing hero + plans: one Pro membership with a Weekly / Monthly / Annual toggle beside Free
 * (Mobbin: Framer, Spline, Better Stack). Checkout and Stripe plan changes go through PaidPlanAction.
 */
export function PricingPlansSection({
  pricing,
  billingContext,
}: {
  pricing: PublicBillingPricing;
  billingContext?: PricingPageBillingContext | null;
}) {
  const [plan, setPlan] = useState<BillingPlanKey>(billingContext?.currentPlanKey ?? "monthly");
  const selected = pricing[plan];
  const [amount, period] = splitPrice(selected.headline);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-6 pt-10 sm:px-6 sm:pt-16">
      <div className="mx-auto max-w-2xl text-center">
        <SectionEyebrow>Pricing</SectionEyebrow>
        <h1 className="mt-3 text-[2.2rem] font-bold leading-[1.05] tracking-[-0.03em] text-white sm:text-[3.25rem]">
          Simple pricing.{" "}
          <span className="block whitespace-nowrap bg-gradient-to-r from-[#a78bfa] via-[var(--vt-coral)] to-[#f472b6] bg-clip-text text-transparent sm:inline">
            Full access.
          </span>
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-300 sm:text-lg">
          Start free. Go Pro for every feature in the app and on the web, billed the way that suits you.
        </p>
      </div>

      {/* Billing period toggle */}
      <div
        role="radiogroup"
        aria-label="Billing period"
        className="mx-auto mt-10 grid max-w-md grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1"
      >
        {PLANS.map(({ key, label }) => {
          const active = key === plan;
          const badge = key === "weekly" ? null : pricing[key].badge;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setPlan(key)}
              className={cn(
                "relative rounded-xl px-2 py-2.5 text-center transition",
                active
                  ? "bg-[linear-gradient(135deg,rgba(76,110,245,0.35),rgba(139,92,246,0.3))] text-white shadow-[0_0_20px_rgba(76,110,245,0.25)]"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-white",
              )}
            >
              {badge ? (
                <span
                  className={cn(
                    "absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                    key === "annual" ? "bg-emerald-500 text-[#04210f]" : "bg-[var(--vt-coral)] text-white",
                  )}
                >
                  {badge}
                </span>
              ) : null}
              <span className="block text-sm font-semibold">{label}</span>
              <span className={cn("mt-0.5 block text-[11px]", active ? "text-white/70" : "text-slate-500")}>
                {pricing[key].dailyEquivalentHeadline}
              </span>
            </button>
          );
        })}
      </div>

      <div id="plans" className="mx-auto mt-8 grid max-w-4xl scroll-mt-20 gap-5 md:grid-cols-2">
        {/* Free */}
        <div className={cn(card, "border border-white/10 bg-white/[0.02]")}>
          <p className="text-sm font-semibold text-slate-300">{pricing.free.badge}</p>
          <p className="mt-4 flex items-baseline gap-1.5">
            <span className="text-5xl font-bold tracking-tight text-white">{pricing.free.headline}</span>
            <span className="text-sm text-slate-400">forever</span>
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">Check any broker or prop firm and try Ask, no card needed.</p>
          <div className="mt-6">
            <Button asChild variant="outline" size="pill" className="w-full">
              {billingContext?.isSignedIn ? (
                <Link href="/ask" prefetch={false}>Open Ask</Link>
              ) : (
                <Link href="/signup">Create free account</Link>
              )}
            </Button>
          </div>
          <ul className="mt-7 space-y-3 border-t border-white/[0.08] pt-6">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                <Check className="mt-0.5 size-4 shrink-0 text-[var(--vt-green)]" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Pro: gradient ring + glow */}
        <div className="order-first rounded-3xl bg-[linear-gradient(135deg,var(--vt-coral),#8b5cf6_50%,var(--vt-blue))] p-px shadow-[0_0_80px_rgba(139,92,246,0.25)] md:order-none">
          <div className={cn(card, "h-full bg-[linear-gradient(160deg,#171a52,var(--vt-navy)_70%)]")}>
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles className="size-4 text-[var(--vt-coral)]" aria-hidden />
              Pro
            </p>
            <p className="mt-4 flex items-baseline gap-1.5">
              <span className="text-5xl font-bold tracking-tight text-white">{amount}</span>
              <span className="text-sm text-slate-400">{period}</span>
            </p>
            <p className="mt-1.5 text-sm font-medium text-[#8fa5ff]">
              {selected.dailyEquivalentHeadline}
              {plan === "annual" ? ` · ${pricing.annual.equivalentMonthlyHeadline}` : null}
            </p>
            {plan === "annual" ? (
              <p className="mt-1 text-sm font-medium text-emerald-400">{pricing.annual.savingsLabel}</p>
            ) : null}
            <div className="mt-6">
              <PaidPlanAction
                billingContext={billingContext}
                checkoutPlan={plan}
                isCurrentPlan={billingContext?.currentPlanKey === plan}
                variant="default"
                defaultLabel={
                  <span className="inline-flex items-center gap-2">
                    {selected.ctaLabel}
                    <ArrowRight className="size-4" aria-hidden />
                  </span>
                }
              />
            </div>
            <ul className="mt-7 space-y-3 border-t border-white/[0.08] pt-6">
              <li className="text-xs font-semibold uppercase tracking-wider text-slate-400">Everything in Free, plus</li>
              {[...PRO_FEATURES, ...(plan === "annual" ? ["Mentorship access"] : [])].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-200">
                  <Check className="mt-0.5 size-4 shrink-0 text-[var(--vt-coral)]" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <ul className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-400">
        <li className="flex items-center gap-1.5">
          <RefreshCcw className="size-3.5" aria-hidden /> Cancel anytime
        </li>
        <li className="flex items-center gap-1.5">
          <Lock className="size-3.5" aria-hidden /> Secure checkout with Stripe
        </li>
        <li>Prices in GBP</li>
      </ul>

      {billingContext?.hasManageableSubscription ? (
        <p className="mx-auto mt-4 max-w-4xl text-center text-xs leading-relaxed text-slate-500">
          Switch billing period above to change plans in Stripe. Payment methods, invoices and subscription updates sync
          back to the app automatically.
        </p>
      ) : null}
    </section>
  );
}

const FEATURES: Array<{ icon: AppIconKey; name: string; tier: "Free" | "Pro"; benefit: string; body: string }> = [
  { icon: "verify", name: "Verify", tier: "Free", benefit: "Check before you fund.", body: "Regulator status, warnings and complaints for brokers, prop firms and educators, each cited to its source." },
  { icon: "ask", name: "Ask", tier: "Free", benefit: "Answers with the working shown.", body: `Ask about a broker, a setup or a market. Free gets ${FREE_DAILY_ASK_LIMIT} chats a day, Pro gets ${PRO_DAILY_ASK_LIMIT}.` },
  { icon: "markets", name: "Markets", tier: "Free", benefit: "Prices that keep up.", body: "Live prices and watchlists across gold, forex, indices and crypto." },
  { icon: "intelligence", name: "Intelligence", tier: "Pro", benefit: "Know the tone before the open.", body: "A daily pre-session brief with a bias, a key level and a one-line verdict for each asset." },
  { icon: "calendar", name: "Economic Calendar", tier: "Pro", benefit: "No more surprise news candles.", body: "CPI, NFP, FOMC and more, with impact levels and a heads-up before high-impact releases." },
  { icon: "journal", name: "Journal", tier: "Pro", benefit: "Find the leak in your trading.", body: "Log trades, track performance and run Challenge Mode for prop firm evaluations." },
  { icon: "mind", name: "Mind", tier: "Pro", benefit: "Trade with a clear head.", body: "Psychology coaching for discipline, tilt and focus. The part no indicator covers." },
  { icon: "community", name: "Community", tier: "Pro", benefit: "You're not trading alone.", body: "A members-only community and priority support from the team." },
];

function TierChip({ tier, className }: { tier: "Free" | "Pro"; className?: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        tier === "Free" ? "bg-emerald-500/15 text-emerald-300" : "bg-violet-500/20 text-violet-300",
        className,
      )}
    >
      {tier}
    </span>
  );
}

/** Feature grid under the plans: app icon, Free/Pro chip, benefit line and short description. */
export function PricingFeatures() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <SectionEyebrow>What you get</SectionEyebrow>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Everything in one membership</h2>
        <p className="mt-3 text-[15px] leading-7 text-slate-400">
          Eight tools that work together, on your phone and on the web.
        </p>
      </div>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        {FEATURES.map((f) => {
          const Icon = APP_ICONS[f.icon];
          return (
            <li
              key={f.name}
              className="flex gap-4 rounded-2xl border border-white/[0.08] bg-[linear-gradient(160deg,rgba(76,110,245,0.09),rgba(255,255,255,0.015)_55%)] p-4 transition hover:border-[var(--vt-blue)]/40 sm:flex-col sm:gap-0 sm:p-5"
            >
              <div className="flex shrink-0 items-start justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--vt-blue)]/15 text-[#8fa5ff]">
                  <Icon className="size-5" />
                </span>
                <TierChip tier={f.tier} className="hidden sm:inline-block" />
              </div>
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-base font-semibold text-white sm:mt-4">
                  {f.name}
                  <TierChip tier={f.tier} className="sm:hidden" />
                </h3>
                <p className="mt-1 text-sm font-medium text-slate-200">{f.benefit}</p>
                <p className="mt-1.5 text-sm leading-6 text-slate-400">{f.body}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
