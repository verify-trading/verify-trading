"use client";

import Link from "next/link";
import {
  Brain,
  CalendarClock,
  CheckCircle2,
  MessagesSquare,
  NotebookPen,
  X,
} from "lucide-react";

import { FAQSection } from "./faq-section";
import { SectionEyebrow, surface } from "./section-primitives";
import { TrackViewContent } from "./track-view-content";
import { HeroAskDemoLazy } from "@/components/landing/hero-ask-demo/lazy";
import type { HeroLiveBriefing } from "@/components/landing/hero-ask-demo/types";
import { PricingPlansSection } from "@/components/pricing/pricing-plans";
import { AppWordmarkInline } from "@/components/site/logo";
import { SiteNav } from "@/components/site/site-nav";
import type { PublicBillingPricing } from "@/lib/billing/config";
import type { PricingPageBillingContext } from "@/lib/billing/pricing-page-data";
import { LEGAL_LINKS } from "@/lib/legal/legal-links";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { trackMetaViewContent } from "@/lib/marketing/meta-pixel";
import { getAppName } from "@/lib/site-config";
import { cn } from "@/lib/utils";

type IconTheme = "blue" | "amber" | "coral" | "purple" | "green" | "cyan";

const featureIconClass: Record<IconTheme, string> = {
  blue: "border-[rgba(76,110,245,0.35)] bg-[rgba(76,110,245,0.12)] text-[var(--vt-blue)]",
  amber: "border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.1)] text-[var(--vt-amber)]",
  coral: "border-[rgba(242,109,109,0.35)] bg-[rgba(242,109,109,0.1)] text-[var(--vt-coral)]",
  purple: "border-[rgba(168,85,247,0.35)] bg-[rgba(168,85,247,0.1)] text-purple-400",
  green: "border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.1)] text-[var(--vt-green)]",
  cyan: "border-[rgba(34,211,238,0.35)] bg-[rgba(34,211,238,0.1)] text-cyan-400",
};

/** Pain icons — use theme `--vt-coral` (same token as hero dot, eyebrows, error accents). */
const pitfallIconShell =
  "flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--vt-coral)] text-white shadow-[0_4px_16px_rgba(242,109,109,0.42)] ring-1 ring-inset ring-white/20";

function PitfallIcon({ variant }: { variant: "exclaim" | "risk" | "close" }) {
  if (variant === "exclaim") {
    return (
      <div className={pitfallIconShell} aria-hidden>
        <span className="text-lg font-black leading-none">!</span>
      </div>
    );
  }
  if (variant === "risk") {
    return (
      <div className={pitfallIconShell} aria-hidden>
        <div className="relative size-6">
          <span className="absolute left-0 top-0 size-1.5 rounded-full bg-white" />
          <span className="absolute right-0 top-0 size-1.5 rounded-full bg-white" />
          <span className="absolute bottom-0 left-0 size-1.5 rounded-full bg-white" />
          <span className="absolute bottom-0 right-0 size-1.5 rounded-full bg-white" />
          <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
        </div>
      </div>
    );
  }
  return (
    <div className={pitfallIconShell} aria-hidden>
      <X className="size-5" strokeWidth={3} />
    </div>
  );
}

/* ─── Hero ─── */

function AppleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 384 512" className={className} fill="currentColor" aria-hidden>
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

function GooglePlayMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M3.609 1.814L13.792 12 3.609 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .61-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 0 1 0 1.73l-2.808 1.626L15.397 12l2.301-2.491zM5.864 2.658L16.802 8.99l-2.302 2.302-8.636-8.634z" />
    </svg>
  );
}

/** App-store download badges. For now both route to /signup. */
function StoreBadges() {
  const badges = [
    {
      icon: <AppleMark className="size-6" />,
      line1: "Download on the",
      line2: "App Store",
      store: "apple",
    },
    {
      icon: <GooglePlayMark className="size-5" />,
      line1: "GET IT ON",
      line2: "Google Play",
      store: "google_play",
    },
  ];
  return (
    <div className="flex flex-row flex-wrap items-center justify-center gap-3">
      {badges.map((b) => (
        <Link
          key={b.line2}
          href="/signup"
          prefetch={false}
          onClick={() =>
            trackAnalyticsEvent(ANALYTICS_EVENTS.appStoreClicked, {
              location: "hero",
              store: b.store,
            })
          }
          className="inline-flex items-center gap-2.5 rounded-xl border border-white/25 bg-black px-4 py-2.5 text-white transition hover:border-white/45 hover:bg-[#0c0c0c]"
        >
          {b.icon}
          <span className="text-left leading-tight">
            <span className="block text-[10px] font-medium text-white/70">{b.line1}</span>
            <span className="block text-[15px] font-semibold tracking-tight">{b.line2}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function HeroSection({ liveGold }: { liveGold: HeroLiveBriefing | null }) {
  const appName = getAppName();

  return (
    <section className="overflow-hidden border-b border-white/[0.06] bg-[radial-gradient(ellipse_110%_55%_at_50%_0%,rgba(76,110,245,0.1),transparent_55%),var(--vt-navy)]">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pb-16 pt-12 text-center sm:px-6 sm:pb-20 sm:pt-16">
        <h1
          className="text-[2.6rem] font-bold leading-[1.02] tracking-[-0.02em] text-white sm:text-[3.25rem] sm:leading-[1.01]"
          aria-label={`${appName}: One Check. Better Decisions. Fewer Losses.`}
        >
          <span className="mb-4 block text-xl font-bold tracking-normal sm:mb-5 sm:text-2xl">
            <AppWordmarkInline />
          </span>
          <span className="block">One Check.</span>
          <span className="block">
            <span className="bg-gradient-to-r from-[#a78bfa] via-[var(--vt-coral)] to-[#f472b6] bg-clip-text text-transparent">
              Better Decisions.
            </span>
          </span>
          <span className="block">Fewer Losses.</span>
        </h1>
        <p className="mt-5 max-w-md text-[15px] font-normal leading-6 text-slate-400 sm:max-w-xl sm:text-base">
          Verify brokers, prop firms and gurus, validate trades, and manage risk
          with live data &amp; AI — all in one place.
        </p>

        <div className="mt-8">
          <StoreBadges />
        </div>

        {/* Phone demo with a soft gradient glow behind it */}
        <div className="relative mt-12 w-full sm:mt-14">
          {/* Wide soft glow blooming out behind the phone */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 z-0 size-[26rem] max-w-[150vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(76,110,245,0.45),rgba(139,92,246,0.22)_45%,transparent_70%)] blur-3xl"
          />
          <div className="relative z-10 mx-auto w-full max-w-[392px]">
            {/* Colored aura that blooms out around the phone edges */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-3 inset-y-6 -z-10 rounded-[3.5rem] bg-gradient-to-b from-[rgba(76,110,245,0.6)] via-[rgba(139,92,246,0.45)] to-[rgba(242,109,109,0.28)] blur-2xl"
            />
            <HeroAskDemoLazy variant="device" liveBriefing={liveGold} />
          </div>
        </div>

        <ul className="mt-10 flex flex-col items-center gap-3 text-[15px] text-slate-300 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-8">
          {["Check any entity in seconds", "Get alerts before everyone else", "Pressure-test your setup"].map(
            (t) => (
              <li key={t} className="flex items-center gap-2">
                <CheckCircle2
                  className="size-4 shrink-0 text-[var(--vt-green)]"
                  aria-hidden
                />
                {t}
              </li>
            ),
          )}
        </ul>
      </div>
    </section>
  );
}

/* ─── Features ─── */

function FeaturesSection() {
  const features: Array<{
    icon: typeof Brain;
    theme: IconTheme;
    title: string;
    description: string;
  }> = [
    {
      icon: NotebookPen,
      theme: "blue",
      title: "Journal",
      description:
        "Logs trades, tags rule-risk behaviour — find the breach pattern before it costs the account.",
    },
    {
      icon: Brain,
      theme: "purple",
      title: "Psychology AI",
      description:
        "A 6-minute assessment, then weekly reviews that surface tilt and revenge-trade patterns.",
    },
    {
      icon: CalendarClock,
      theme: "amber",
      title: "Calendar + Intelligence",
      description:
        "Red-folder events that breach news rules, plus session context before you sit down.",
    },
    {
      icon: MessagesSquare,
      theme: "green",
      title: "Ask + Community",
      description:
        "20 AI asks a day on records, markets and news — plus a members-only room.",
    },
  ];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="max-w-2xl">
        <SectionEyebrow>Pro</SectionEyebrow>
        <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
          verify.trading Pro
        </h2>
        <p className="mt-4 text-lg font-semibold leading-snug text-slate-200 sm:text-xl">
          Verify protects you from them.{" "}
          <span className="text-[var(--vt-coral)]">Pro protects you from yourself.</span>
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <div
              key={f.title}
              className={cn(
                surface,
                "flex h-full flex-col p-6 transition-colors hover:border-white/[0.12] hover:bg-white/[0.03]",
              )}
            >
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-lg border",
                  featureIconClass[f.theme],
                )}
              >
                <Icon className="size-5" strokeWidth={1.75} aria-hidden />
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-white">{f.title}</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-400">{f.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── Three pitfalls ─── */

function HowItWorksSection() {
  const pitfalls = [
    {
      variant: "close" as const,
      title: "Trusting the wrong entities",
      description: "Scam brokers, fake prop firms and gurus drain accounts before the first trade.",
    },
    {
      variant: "exclaim" as const,
      title: "Entering trades too early",
      description: "No confirmation. No edge. Just guesswork.",
    },
    {
      variant: "risk" as const,
      title: "Risking too much per position",
      description: "Over-leverage turns one loss into a margin call.",
    },
  ];

  return (
    <section className="border-y border-white/[0.06] bg-black/15">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="max-w-2xl">
          <SectionEyebrow>Three pitfalls</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
            {"Most traders don't lose from bad strategy."}
          </h2>
          <p className="mt-4 text-xl font-semibold leading-snug text-[var(--vt-coral)] sm:text-2xl">
            They lose from bad decisions.
          </p>
        </div>

        <div className="mt-10 space-y-6">
          <div className="grid gap-6 md:grid-cols-3 md:gap-8">
            {pitfalls.map((p) => (
              <div
                key={p.title}
                className={cn(surface, "p-5 transition-colors hover:border-white/[0.12] sm:p-6")}
              >
                <div className="flex gap-4">
                  <PitfallIcon variant={p.variant} />
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold leading-snug text-white">{p.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">{p.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className={cn(surface, "px-5 py-5 text-center sm:px-8 sm:py-6")}>
            <p className="text-base leading-snug text-white sm:text-lg">
              One mistake can{" "}
              <span className="font-semibold text-[var(--vt-coral)]">wipe your account.</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Closing (lights on) ─── */

function ClosingSection() {
  return (
    <section className="text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        {/* "Lights on" reveal card */}
        <div className="relative overflow-hidden rounded-[2rem] bg-[#0a1126] bg-[radial-gradient(110%_110%_at_8%_4%,rgba(76,110,245,0.32),transparent_52%),radial-gradient(120%_120%_at_55%_115%,rgba(139,92,246,0.22),transparent_60%),radial-gradient(110%_110%_at_96%_92%,rgba(242,109,109,0.2),transparent_55%)] px-6 py-16 text-center text-white shadow-[0_30px_80px_-40px_rgba(0,0,0,0.55)] ring-1 ring-inset ring-white/10 sm:px-10 sm:py-24">
          <h2 className="mx-auto max-w-3xl text-3xl font-bold tracking-[-0.03em] sm:text-5xl">
            Welcome to trading with the lights on.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/70 sm:text-lg">
            Run your first check now — it’s free, and it stays free.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/ask"
              prefetch={false}
              onClick={() =>
                trackAnalyticsEvent(ANALYTICS_EVENTS.openAskClicked, {
                  location: "homepage_closing_cta",
                  label: "Check a name",
                })
              }
              className="inline-flex items-center justify-center rounded-full bg-white px-7 py-3 text-sm font-semibold text-[#0a0d2e] transition hover:bg-white/90"
            >
              Check a name
            </Link>
            <Link
              href="/methodology"
              onClick={() =>
                trackAnalyticsEvent(ANALYTICS_EVENTS.guideClicked, {
                  location: "homepage_closing_cta",
                  label: "See the methodology",
                })
              }
              className="inline-flex items-center justify-center rounded-full border border-white/30 px-7 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              See the methodology
            </Link>
          </div>
        </div>

        {/* Independence statement */}
        <p className="mt-12 max-w-4xl text-sm leading-relaxed text-white/60">
          <span className="font-semibold text-white">Independence, in writing:</span> we take no
          affiliate commissions from brokers, prop firms or educators, and rated entities cannot be
          our affiliates. Verdicts are computed from regulator records and are not for sale.
          Verify.Trading provides records and analysis, not investment advice; trading involves
          significant risk of loss. Absence of a regulatory action is not an endorsement, and absence
          from a regulator’s list is not proof of authorisation.
        </p>

        {/* Footer links */}
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/10 pt-6 text-sm">
          <Link
            href="/methodology"
            className="font-medium text-white/70 underline-offset-4 transition hover:text-white hover:underline"
          >
            Methodology
          </Link>
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-medium text-white/70 underline-offset-4 transition hover:text-white hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.15em] text-white/40">
          © 2026 verify.trading · UK · Records re-checked on a rolling basis
        </p>
      </div>
    </section>
  );
}

/* ─── Page ─── */

export function LandingPage({
  pricing,
  billingContext,
  liveGold,
}: {
  pricing: PublicBillingPricing;
  billingContext: PricingPageBillingContext | null;
  liveGold: HeroLiveBriefing | null;
}) {
  return (
    <div className="min-h-screen bg-[var(--vt-navy)] text-white">
      <SiteNav />
      <TrackViewContent />
      <main>
        <HeroSection liveGold={liveGold} />
        <HowItWorksSection />
        <FeaturesSection />
        <PricingPlansSection pricing={pricing} billingContext={billingContext} hideFreePlan />
        <FAQSection />
        <ClosingSection />
      </main>
    </div>
  );
}
