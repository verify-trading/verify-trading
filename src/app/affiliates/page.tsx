import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Coins,
  Target,
  Calendar,
  BarChart3,
  Clock,
  Rocket,
  Shield,
  TrendingUp,
  Zap,
  Wallet,
  Sparkles,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Affiliate Programme — Earn 30% Recurring | verify.trading",
  description:
    "Turn referrals into recurring revenue. Earn 30% commission every month, for every Pro member you refer to verify.trading. No caps, no expiry.",
};

const APPLY_URL = "https://verify-trading.getrewardful.com/signup";
const SUPPORT_EMAIL = "affiliates@verify.trading";

const surface = "rounded-xl border border-white/[0.08] bg-white/[0.02]";

type IconTheme = "blue" | "amber" | "coral" | "purple" | "green" | "cyan";

const featureIconClass: Record<IconTheme, string> = {
  blue: "border-[rgba(76,110,245,0.35)] bg-[rgba(76,110,245,0.12)] text-[var(--vt-blue)]",
  amber: "border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.1)] text-[var(--vt-amber)]",
  coral: "border-[rgba(242,109,109,0.35)] bg-[rgba(242,109,109,0.1)] text-[var(--vt-coral)]",
  purple: "border-[rgba(168,85,247,0.35)] bg-[rgba(168,85,247,0.1)] text-purple-400",
  green: "border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.1)] text-[var(--vt-green)]",
  cyan: "border-[rgba(34,211,238,0.35)] bg-[rgba(34,211,238,0.1)] text-cyan-400",
};

const ctaButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-violet-500 px-8 text-sm font-semibold text-white shadow-[0_0_40px_rgba(139,92,246,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_0_50px_rgba(139,92,246,0.45)]";

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-coral)]/90">
      {children}
    </p>
  );
}

function CtaButton({ size = "default", className }: { size?: "default" | "large"; className?: string }) {
  const sizeClass = size === "large" ? "h-[52px] text-[15px]" : "h-12";
  return (
    <Link href={APPLY_URL} prefetch={false} className={cn(ctaButtonClass, sizeClass, className)}>
      Partner with verify.trading
      <ArrowRight className="size-4" aria-hidden />
    </Link>
  );
}

/* ─── Hero ─── */

function HeroSection() {
  return (
    <section className="border-b border-white/[0.06] bg-[radial-gradient(ellipse_90%_70%_at_50%_0%,rgba(76,110,245,0.12),transparent_55%),var(--vt-navy)]">
      <div className="mx-auto w-full max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <SectionEyebrow>Affiliate Programme</SectionEyebrow>
        <h1 className="mt-4 text-4xl font-bold tracking-[-0.03em] text-white sm:text-5xl sm:leading-[1.05] lg:text-6xl">
          Turn referrals into{" "}
          <span className="text-[var(--vt-blue)]">recurring revenue.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-400 sm:mt-7 sm:text-lg">
          Earn 30% commission every month, for every trader you refer to verify.trading. No caps. No expiry. Real recurring income, paid monthly.
        </p>
        <div className="mt-8 flex justify-center sm:mt-10">
          <CtaButton />
        </div>
        <ul className="mt-10 flex flex-col items-center justify-center gap-3 text-sm text-slate-400 sm:mt-12 sm:flex-row sm:flex-wrap sm:gap-x-7 sm:gap-y-2">
          {["30% recurring commission", "Monthly payouts", "60-day cookie window"].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <CheckCircle2 className="size-3.5 shrink-0 text-[var(--vt-green)]" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ─── Stats Band (overlapping) ─── */

function StatsBandSection() {
  const stats = [
    { label: "Earn", value: "30%", sub: "recurring commission" },
    { label: "For", value: "Every", sub: "month they stay" },
    { label: "Payout in", value: "30 days", sub: "every month" },
  ];

  return (
    <section className="mx-auto w-full max-w-5xl px-4 sm:px-6">
      <div className="-mt-12 grid grid-cols-1 gap-6 rounded-2xl border border-white/[0.08] bg-[var(--vt-navy)]/95 p-8 shadow-[0_24px_64px_-28px_rgba(0,0,0,0.55),inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur sm:-mt-16 sm:grid-cols-3 sm:p-10">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={cn(
              "text-center sm:px-6",
              i === 1 && "border-y border-white/[0.06] py-4 sm:border-x sm:border-y-0 sm:py-0",
            )}
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
              {s.label}
            </p>
            <p className="mt-3 text-5xl font-bold tracking-[-0.03em] text-[var(--vt-blue)] sm:text-6xl">
              {s.value}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-200 sm:text-base">{s.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Why Partner (6 cards) ─── */

function WhyPartnerSection() {
  const cards: Array<{ icon: typeof Coins; theme: IconTheme; title: string; body: string }> = [
    {
      icon: Coins,
      theme: "blue",
      title: "Recurring commission",
      body: "Earn 30% of every Pro subscription, every single month they stay. No caps, no expiry — pure recurring income.",
    },
    {
      icon: Target,
      theme: "coral",
      title: "Real product, real demand",
      body: "verify.trading helps traders verify brokers and signals — a genuine pain point that converts naturally.",
    },
    {
      icon: Calendar,
      theme: "green",
      title: "Monthly payouts",
      body: "Get paid via PayPal or Wise once your balance hits £20. Predictable. Automated. No chasing invoices.",
    },
    {
      icon: BarChart3,
      theme: "purple",
      title: "Real-time dashboard",
      body: "Track clicks, signups, and earnings in real time. Powered by Rewardful + Stripe — accurate down to the second.",
    },
    {
      icon: Clock,
      theme: "amber",
      title: "60-day cookie window",
      body: "Get credit for signups up to 60 days after the click. Plenty of time to convert your traffic.",
    },
    {
      icon: Rocket,
      theme: "cyan",
      title: "Built for creators",
      body: "Twitter/X, Discord, trading educators, course creators. Built around how real audiences actually convert.",
    },
  ];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="max-w-2xl">
        <SectionEyebrow>Why partner</SectionEyebrow>
        <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
          Why partner with verify.trading?
        </h2>
        <p className="mt-4 text-base leading-relaxed text-slate-400">
          Six reasons creators, educators, and community admins choose us.
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.title}
              className={cn(
                surface,
                "flex h-full flex-col p-6 transition-colors hover:border-white/[0.12] hover:bg-white/[0.03]",
              )}
            >
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-lg border",
                  featureIconClass[c.theme],
                )}
              >
                <Icon className="size-5" strokeWidth={1.75} aria-hidden />
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-white">{c.title}</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-400">{c.body}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── Earnings Table ─── */

function EarningsSection() {
  const rows = [
    { num: "1", label: "referral", monthly: "£6 / month", annual: "£72 / year" },
    { num: "5", label: "referrals", monthly: "£30 / month", annual: "£360 / year" },
    { num: "10", label: "referrals", monthly: "£60 / month", annual: "£720 / year" },
    { num: "25", label: "referrals", monthly: "£150 / month", annual: "£1,800 / year" },
    { num: "50", label: "referrals", monthly: "£300 / month", annual: "£3,600 / year" },
  ];

  return (
    <section className="border-y border-white/[0.06] bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(76,110,245,0.06),transparent_70%)]">
      <div className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="text-center">
          <SectionEyebrow>Earning potential</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
            Your earning potential.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-400">
            30% recurring commission on every Pro subscription. Based on £20/month plan.
          </p>
        </div>

        <div className={cn(surface, "mt-10 overflow-hidden")}>
          <table className="w-full text-left">
            <thead className="bg-[rgba(76,110,245,0.06)]">
              <tr>
                <th className="border-b border-white/[0.08] px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-blue)] sm:px-7 sm:py-5">
                  Referrals
                </th>
                <th className="border-b border-white/[0.08] px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-blue)] sm:px-7 sm:py-5">
                  Monthly
                </th>
                <th className="border-b border-white/[0.08] px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-blue)] sm:px-7 sm:py-5">
                  Annual
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.num}
                  className={cn(
                    "transition-colors hover:bg-white/[0.02]",
                    i < rows.length - 1 && "border-b border-white/[0.04]",
                  )}
                >
                  <td className="px-5 py-5 text-sm text-slate-300 sm:px-7 sm:py-6 sm:text-base">
                    <span className="mr-1.5 text-base font-semibold text-white sm:text-lg">
                      {r.num}
                    </span>
                    {r.label}
                  </td>
                  <td className="px-5 py-5 text-sm font-semibold text-[var(--vt-blue)] sm:px-7 sm:py-6 sm:text-base">
                    {r.monthly}
                  </td>
                  <td className="px-5 py-5 text-sm font-semibold text-[var(--vt-blue)] sm:px-7 sm:py-6 sm:text-base">
                    {r.annual}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 text-center">
          <CtaButton />
          <p className="mt-4 text-xs text-slate-500">
            *Estimates based on full retention. Actual earnings vary by audience and churn.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── Why Traders Choose (6 features) ─── */

function WhyTradersChooseSection() {
  const features: Array<{ icon: typeof Shield; theme: IconTheme; title: string; body: string }> = [
    {
      icon: Shield,
      theme: "green",
      title: "Broker verification",
      body: "Help traders avoid scams. Verify brokers, regulations, and licensing instantly with live data.",
    },
    {
      icon: TrendingUp,
      theme: "blue",
      title: "Signal authenticity",
      body: "Cut through the noise. Verify trading signals against real market data — no fake promises.",
    },
    {
      icon: Zap,
      theme: "amber",
      title: "Live market data",
      body: "Real-time data and AI-powered checks. No stale info, no guesswork — answers in seconds.",
    },
    {
      icon: Wallet,
      theme: "coral",
      title: "Affordable pricing",
      body: "£5 first-month launch offer makes it an easy yes. Low barrier = higher conversion from your traffic.",
    },
    {
      icon: Sparkles,
      theme: "purple",
      title: "Simple onboarding",
      body: "Sign up and get value in minutes. No setup, no friction — just one check and better decisions.",
    },
    {
      icon: Users,
      theme: "cyan",
      title: "Trader-first product",
      body: "Built by traders, for traders. Your audience will recognise the value the moment they try it.",
    },
  ];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="max-w-2xl">
        <SectionEyebrow>Why it converts</SectionEyebrow>
        <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
          Why traders choose verify.trading.
        </h2>
        <p className="mt-4 text-base leading-relaxed text-slate-400">
          A product that converts because it solves a real problem. Easy for your audience to say yes to.
        </p>
      </div>

      <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.title}>
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-lg border",
                  featureIconClass[f.theme],
                )}
              >
                <Icon className="size-5" strokeWidth={1.75} aria-hidden />
              </div>
              <h3 className="mt-4 text-base font-semibold tracking-tight text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.body}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── Steps (Join as a partner) ─── */

function StepsSection() {
  const steps = [
    {
      num: "01",
      title: "Apply in 60 seconds",
      body: "Sign up, share a few details about your audience, and get approved fast.",
    },
    {
      num: "02",
      title: "Share your link",
      body: "Drop your unique referral link in tweets, Discord, newsletters, videos — anywhere your audience hangs out.",
    },
    {
      num: "03",
      title: "Earn every month",
      body: "30% recurring commission lands in your account every month, for as long as they stay subscribed.",
    },
  ];

  return (
    <section className="border-t border-white/[0.06]">
      <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="max-w-2xl">
          <SectionEyebrow>Get started</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
            Join as a partner today.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-400">
            You&apos;re a few simple steps away from earning your first commission.
          </p>
        </div>

        <div className="relative mt-14">
          <div
            className="pointer-events-none absolute left-[14%] right-[14%] top-[60px] hidden h-px bg-gradient-to-r from-transparent via-[var(--vt-blue)]/30 to-transparent sm:block"
            aria-hidden
          />
          <div className="relative grid gap-10 sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.num} className="text-center">
                <p className="inline-block text-7xl font-bold leading-none tracking-[-0.04em] text-[var(--vt-blue)] sm:text-8xl">
                  {s.num}
                </p>
                <h3 className="mt-6 text-lg font-semibold text-white sm:text-xl">{s.title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-400">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 text-center">
          <CtaButton size="large" />
          <p className="mt-4 text-sm text-slate-500">
            Questions? Email{" "}
            
              href={"mailto:" + SUPPORT_EMAIL}
              className="text-[var(--vt-blue)] transition-colors hover:text-[var(--vt-coral)]"
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── Page ─── */

export default function AffiliatesPage() {
  return (
    <main>
      <HeroSection />
      <StatsBandSection />
      <WhyPartnerSection />
      <EarningsSection />
      <WhyTradersChooseSection />
      <StepsSection />
    </main>
  );
}
