"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Shield,
  Calculator,
  TrendingUp,
  ChevronDown,
  Upload,
  Scale,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { HeroAskDemo } from "@/components/landing/hero-ask-demo";
import { PricingPlansSection } from "@/components/pricing/pricing-plans";
import { AppWordmarkInline, Logo } from "@/components/site/logo";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import type { PublicBillingPricing } from "@/lib/billing/config";
import type { PricingPageBillingContext } from "@/lib/billing/pricing-page-data";
import { FREE_DAILY_ASK_LIMIT } from "@/lib/rate-limit/usage";
import { trackMetaViewContent } from "@/lib/marketing/meta-pixel";
import { getAppName } from "@/lib/site-config";
import { cn } from "@/lib/utils";

const surface =
  "rounded-xl border border-white/[0.08] bg-white/[0.02]";

type IconTheme = "blue" | "amber" | "coral" | "purple" | "green" | "cyan";

const featureIconClass: Record<IconTheme, string> = {
  blue: "border-[rgba(76,110,245,0.35)] bg-[rgba(76,110,245,0.12)] text-[var(--vt-blue)]",
  amber: "border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.1)] text-[var(--vt-amber)]",
  coral: "border-[rgba(242,109,109,0.35)] bg-[rgba(242,109,109,0.1)] text-[var(--vt-coral)]",
  purple: "border-[rgba(168,85,247,0.35)] bg-[rgba(168,85,247,0.1)] text-purple-400",
  green: "border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.1)] text-[var(--vt-green)]",
  cyan: "border-[rgba(34,211,238,0.35)] bg-[rgba(34,211,238,0.1)] text-cyan-400",
};

const featureFooterClass: Record<IconTheme, string> = {
  blue: "text-[var(--vt-blue)]",
  amber: "text-[var(--vt-amber)]",
  coral: "text-[var(--vt-coral)]",
  purple: "text-purple-400",
  green: "text-[var(--vt-green)]",
  cyan: "text-cyan-400",
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

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-coral)]/90">
      {children}
    </p>
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

function HeroSection() {
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
          Verify traders, validate trades, and manage risk with live data &amp; AI -
          all in one place.
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
            <HeroAskDemo variant="device" />
          </div>
        </div>

        <ul className="mt-10 flex flex-col items-center gap-3 text-[15px] text-slate-300 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-8">
          {["Stop bad trades in seconds", "Avoid any scams", "Control your risk"].map(
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
  const appName = getAppName();

  const features: Array<{
    icon: typeof Shield;
    theme: IconTheme;
    title: string;
    bullets: string[];
    footer?: string;
  }> = [
      {
        icon: TrendingUp,
        theme: "blue",
        title: "Verify your trade before entry",
        bullets: [
          "Risk / Reward check",
          "Structure validation",
          "Confirmation logic",
          "Key insight in 1 line",
        ],
        footer: "Stop losing trades before they happen.",
      },
      {
        icon: Shield,
        theme: "green",
        title: "Verify any broker in 2 seconds",
        bullets: [
          "Regulation status (FCA, ASIC, CySEC…)",
          "Trust score",
          "Complaint history",
          "Final AI verdict",
        ],
        footer: "Avoid scams before you deposit.",
      },

      {
        icon: Calculator,
        theme: "purple",
        title: "Calculate your risk instantly",
        bullets: ["Lot size calculator", "Pip value", "Reward ratio", "6 professional tools"],
        footer: "Trade like a professional.",
      },
      {
        icon: Upload,
        theme: "amber",
        title: "Input your trade",
        bullets: ["Pair", "Entry price", "Stop loss", "Take profit", "Upload chart (optional)"],
      },
      {
        icon: Activity,
        theme: "coral",
        title: "AI analysis",
        bullets: [
          "Checking structure",
          "Evaluating risk",
          "Scanning for errors",
          "Calculating probability",
        ],
        footer: "Analyzing trade…",
      },
      {
        icon: Scale,
        theme: "cyan",
        title: "Verdict",
        bullets: [
          "DO NOT TRADE — High risk",
          "WEAK TRADE — Fixable",
          "VALID SETUP — Good to go",
        ],
      },
    ];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="max-w-2xl">
        <SectionEyebrow>Features</SectionEyebrow>
        <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
          AI Decision Engine for Traders
        </h2>
        <p className="mt-4 text-base leading-relaxed text-slate-400">
          {appName} reduces guesswork: artificial intelligence built with verified inputs, structured routing, and
          deterministic maths, the only AI that thinks like a trader.
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              <ul className="mt-3 flex-1 list-disc list-outside space-y-1.5 pl-5 text-sm leading-relaxed text-slate-400 marker:text-slate-600">
                {f.bullets.map((line) => (
                  <li key={`${f.title}-${line}`}>{line}</li>
                ))}
              </ul>
              {f.footer ? (
                <p className={cn("mt-4 text-sm font-medium", featureFooterClass[f.theme])}>{f.footer}</p>
              ) : null}
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
      variant: "exclaim" as const,
      title: "Entering trades too early",
      description: "No confirmation. No edge. Just guesswork.",
    },
    {
      variant: "risk" as const,
      title: "Risking too much per position",
      description: "Over-leverage turns one loss into a margin call.",
    },
    {
      variant: "close" as const,
      title: "Trusting the wrong broker",
      description: "Many traders lose money before they even start.",
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
                className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 transition-colors hover:border-white/[0.12] sm:p-6"
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

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-5 text-center sm:px-8 sm:py-6">
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

/* ─── FAQ ─── */

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const appName = getAppName();

  const faqs = [
    {
      q: "What makes this different from ChatGPT?",
      a: "Structured routing. Broker checks use a seeded layer; market data from feeds; maths from deterministic engines—not a single generic completion.",
    },
    {
      q: "Is the market data real-time?",
      a: "We use FMP’s professional feed. Prices refresh on dashboard visits and are cached for 15 minutes. Pro sees live data for all supported assets.",
    },
    {
      q: "Can I cancel anytime?",
      a: "Yes. Cancel from billing; you keep access through the end of the paid period.",
    },
    {
      q: "Which platforms do you support?",
      a: `${appName} is platform-agnostic: we verify and analyse—you trade where you want.`,
    },
  ];

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="max-w-2xl">
        <SectionEyebrow>FAQ</SectionEyebrow>
        <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">Common questions</h2>
      </div>

      <div className="mt-10 space-y-2">
        {faqs.map((f, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={f.q} className={cn(surface, "overflow-hidden")}>
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vt-blue)]/50"
                aria-expanded={isOpen}
              >
                <span className="text-[15px] font-semibold leading-snug text-white">{f.q}</span>
                <ChevronDown
                  className={cn(
                    "mt-0.5 size-5 shrink-0 text-[var(--vt-blue)] transition-transform duration-200",
                    isOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>
              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out",
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <p className="border-t border-white/[0.06] px-5 pb-4 pt-3 text-sm leading-relaxed text-slate-400">
                    {f.a}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── Guide CTA ─── */

function GuideCTASection() {
  return (
    <section className="border-t border-white/[0.06] bg-black/15">
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-left sm:px-6 sm:py-24">
        <div className="max-w-2xl">
          <SectionEyebrow>Guide</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
            Before You Trade: Read This
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-400">
            A step-by-step guide to verifying trades, avoiding risk, and using every feature in seconds.
          </p>
        </div>

        <Button asChild variant="default" size="pill" className="mt-8 gap-2 px-6">
          <Link
            href="/guide"
            onClick={() =>
              trackAnalyticsEvent(ANALYTICS_EVENTS.guideClicked, {
                location: "homepage_guide_cta",
              })
            }
          >
            Get the guide
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  );
}

/* ─── Final CTA ─── */

function FinalCTASection() {
  const benefits = [
    `${FREE_DAILY_ASK_LIMIT} free Ask chats per day`,
    "No credit card required",
    "Cancel anytime",
  ];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div
        className={cn(
          surface,
          "bg-gradient-to-r from-[rgba(76,110,245,0.06)] to-transparent px-6 py-10 sm:px-10 sm:py-12",
        )}
      >
        <div className="flex flex-col gap-8 lg:flex-row lg:items-stretch lg:gap-10">
          <div className="flex min-w-0 flex-1 flex-col gap-6 sm:flex-row sm:items-start sm:gap-5">
            <div className="shrink-0 pt-0.5" aria-hidden>
              <Logo compact />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold tracking-[-0.03em] text-white sm:text-3xl">
                Ready to trade with clearer answers?
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">
                {`Start with ${FREE_DAILY_ASK_LIMIT} free Ask chats per day—no card required.`}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild variant="default" size="pill" className="gap-2 px-6">
                  <Link
                    href="/signup"
                    onClick={() =>
                      trackAnalyticsEvent(ANALYTICS_EVENTS.createAccountClicked, {
                        location: "homepage_final_cta",
                      })
                    }
                  >
                    Create free account
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="pill" className="px-6">
                  <Link
                    href="/ask"
                    prefetch={false}
                    onClick={() =>
                      trackAnalyticsEvent(ANALYTICS_EVENTS.openAskClicked, {
                        location: "homepage_final_cta",
                      })
                    }
                  >
                    Open Ask
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="hidden h-auto w-px shrink-0 bg-white/[0.08] lg:block" aria-hidden />

          <ul className="flex flex-col justify-center gap-3 border-t border-white/[0.08] pt-6 lg:max-w-[14rem] lg:shrink-0 lg:border-t-0 lg:pt-0">
            {benefits.map((t) => (
              <li key={t} className="flex items-center gap-2.5 text-sm text-slate-300">
                <CheckCircle2 className="size-4 shrink-0 text-[var(--vt-coral)]" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ─── Page ─── */

export function LandingPage({
  pricing,
  billingContext,
}: {
  pricing: PublicBillingPricing;
  billingContext: PricingPageBillingContext | null;
}) {
  useEffect(() => {
    trackMetaViewContent();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--vt-navy)] text-white">
      <SiteNav />
      <main>
        <HeroSection />
        <HowItWorksSection />
        <FeaturesSection />
        <PricingPlansSection pricing={pricing} billingContext={billingContext} />
        <FAQSection />
        <GuideCTASection />
        <FinalCTASection />
      </main>
      <SiteFooter />
    </div>
  );
}
