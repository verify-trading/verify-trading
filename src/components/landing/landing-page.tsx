"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Shield,
  BarChart3,
  Calculator,
  Zap,
  TrendingUp,
  Lock,
  Mail,
  ChevronDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PricingPlansSection } from "@/components/pricing/pricing-plans";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import type { PublicBillingPricing } from "@/lib/billing/config";
import type { PricingPageBillingContext } from "@/lib/billing/pricing-page-data";
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

const stepAccentClass: Record<"01" | "02" | "03", string> = {
  "01": "border-[rgba(76,110,245,0.4)] bg-[rgba(76,110,245,0.15)] text-[var(--vt-blue)]",
  "02": "border-[rgba(242,109,109,0.4)] bg-[rgba(242,109,109,0.12)] text-[var(--vt-coral)]",
  "03": "border-[rgba(34,197,94,0.4)] bg-[rgba(34,197,94,0.12)] text-[var(--vt-green)]",
};

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-coral)]/90">
      {children}
    </p>
  );
}

/* ─── Hero ─── */

function HeroSection() {
  const appName = getAppName();

  return (
    <section className="border-b border-white/[0.06]">
      {/*
        Hero video (right column): when ready, wrap content below in:
        `grid w-full max-w-6xl gap-10 md:grid-cols-2 md:items-center md:gap-12 lg:gap-16`
        and add a second column with e.g. aspect-video + embedded player.
      */}
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:py-24">
        <div className="min-w-0 max-w-2xl text-left">
          <SectionEyebrow>Launch · 6 June 2026</SectionEyebrow>
          <h1 className="mt-4 text-4xl font-bold tracking-[-0.03em] text-white sm:text-5xl sm:leading-[1.08]">
            The Bloomberg Terminal for retail traders.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-400 sm:text-[17px] sm:leading-8">
            {appName} routes every Ask into the right system: live market data, seeded verification, deterministic
            calculators, chart analysis, and projection modelling.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="default" size="pill" className="gap-2 px-6">
              <Link href="/signup">
                Start free
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="outline" size="pill" className="px-6">
              <Link href="/markets">View markets</Link>
            </Button>
          </div>
          <ul className="mt-8 flex flex-col gap-2 text-sm text-slate-500 sm:flex-row sm:flex-wrap sm:gap-x-8 sm:gap-y-2">
            {["No credit card required", "10 free Ask chats / day", "Cancel anytime"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 shrink-0 text-[var(--vt-green)]" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ─── Features ─── */

function FeaturesSection() {
  const features: Array<{
    icon: typeof Shield;
    theme: IconTheme;
    label: string;
    title: string;
    description: string;
  }> = [
    {
      icon: Shield,
      theme: "blue",
      label: "Verification",
      title: "Seeded trust layer",
      description:
        "Broker, prop-firm, and guru checks use the client dataset first. Unknown names fail safely instead of bluffing.",
    },
    {
      icon: BarChart3,
      theme: "amber",
      label: "Market data",
      title: "Live briefing path",
      description:
        "FMP powers supported assets. Answers are formatted for you; figures come from the feed, not from guesses.",
    },
    {
      icon: Calculator,
      theme: "coral",
      label: "Math engine",
      title: "Deterministic outputs",
      description:
        "Lot size and projection cards use backend formulas. Numbers in the UI match the engine, not prose.",
    },
    {
      icon: Zap,
      theme: "purple",
      label: "Routing",
      title: "Structured pipeline",
      description:
        "Each question is classified and routed—verification, data, maths, or analysis—before the model responds.",
    },
    {
      icon: TrendingUp,
      theme: "green",
      label: "Charts",
      title: "Technical analysis",
      description:
        "Support, resistance, and trend use real closes—not narrative pattern-matching by the LLM.",
    },
    {
      icon: Lock,
      theme: "cyan",
      label: "Security",
      title: "Session-scoped data",
      description:
        "Prompts and results stay in your session. Supabase auth with RLS; no training on your conversations.",
    },
  ];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="max-w-2xl">
        <SectionEyebrow>Features</SectionEyebrow>
        <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">Built for verification, not vibes</h2>
        <p className="mt-4 text-base leading-relaxed text-slate-400">
          Every layer reduces guesswork: verified inputs, structured routing, deterministic maths where it matters.
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.title} className={cn(surface, "p-6 transition-colors hover:border-white/[0.12] hover:bg-white/[0.03]")}>
              <div
                className={cn(
                  "flex size-11 items-center justify-center rounded-lg border",
                  featureIconClass[f.theme],
                )}
              >
                <Icon className="size-5" strokeWidth={1.75} aria-hidden />
              </div>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{f.label}</p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── How it works ─── */

function HowItWorksSection() {
  const steps = [
    {
      step: "01",
      title: "Ask a question",
      description:
        "Natural language—broker check, lot size, market briefing, or anything trading-related.",
    },
    {
      step: "02",
      title: "Smart routing",
      description:
        "Intent is classified and sent to verification, data feed, or math—before generation.",
    },
    {
      step: "03",
      title: "Verified answer",
      description:
        "Structured, source-linked output. Numbers tie back to data or formulas.",
    },
  ];

  return (
    <section className="border-y border-white/[0.06] bg-black/15">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="max-w-2xl">
          <SectionEyebrow>How it works</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">Three steps</h2>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3 md:gap-8">
          {steps.map((s) => (
            <div
              key={s.step}
              className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 transition-colors hover:border-white/[0.12]"
            >
              <div
                className={cn(
                  "inline-flex size-11 items-center justify-center rounded-full border font-mono text-sm font-bold tabular-nums",
                  stepAccentClass[s.step as "01" | "02" | "03"],
                )}
              >
                {s.step}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ ─── */

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

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
      a: "verify.trading is platform-agnostic: we verify and analyse—you trade where you want.",
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

/* ─── Email CTA ─── */

function EmailCTASection() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, source: "landing_guide" }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };

      if (res.ok && data.ok) {
        setStatus("success");
        setEmail("");
      } else {
        setStatus("error");
        setErrorMsg(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please check your connection and try again.");
    }
  }

  return (
    <section className="border-t border-white/[0.06] bg-black/15">
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-left sm:px-6 sm:py-24">
        <div className="max-w-2xl">
          <SectionEyebrow>Guide</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">Get the free trading guide</h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-400">
            We&apos;ll email a concise guide on broker verification, risk management, and using verify.trading effectively.
          </p>
        </div>

        {status === "success" ? (
          <div className="mt-8 flex max-w-md items-center gap-3 rounded-lg border border-[var(--vt-green)]/30 bg-[var(--vt-green)]/10 px-4 py-3 text-sm font-medium text-[var(--vt-green)]">
            <CheckCircle2 className="size-5 shrink-0" aria-hidden />
            You&apos;re in. Check your inbox for the guide.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 flex max-w-lg flex-col gap-3 sm:flex-row sm:items-stretch">
            <div className="relative min-w-0 flex-1">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Work email"
                disabled={status === "loading"}
                className="h-11 w-full rounded-lg border border-white/[0.1] bg-white/[0.03] pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-[var(--vt-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--vt-blue)]/20 disabled:opacity-60"
                id="landing-email-input"
              />
            </div>
            <Button type="submit" variant="default" size="pill" className="gap-2 px-6 sm:h-11" disabled={status === "loading"}>
              {status === "loading" ? (
                <>
                  <span className="inline-block size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Sending…
                </>
              ) : (
                <>
                  Get the guide
                  <ArrowRight className="size-4" aria-hidden />
                </>
              )}
            </Button>
          </form>
        )}

        {status === "error" && errorMsg ? <p className="mt-3 text-sm text-[var(--vt-coral)]">{errorMsg}</p> : null}

        <p className="mt-4 text-xs text-slate-500">No spam. Unsubscribe anytime.</p>
      </div>
    </section>
  );
}

/* ─── Final CTA ─── */

function FinalCTASection() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div
        className={cn(
          surface,
          "bg-gradient-to-r from-[rgba(76,110,245,0.06)] to-transparent px-6 py-10 sm:px-10 sm:py-12",
        )}
      >
        <div className="max-w-xl">
          <h2 className="text-2xl font-bold tracking-[-0.03em] text-white sm:text-3xl">Ready to trade with clearer answers?</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">
            Start with 10 free Ask chats per day—no card required.
          </p>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="default" size="pill" className="gap-2 px-6">
            <Link href="/signup">
              Create free account
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="outline" size="pill" className="px-6">
            <Link href="/ask">Open Ask</Link>
          </Button>
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
  return (
    <div className="min-h-screen bg-[var(--vt-navy)] text-white">
      <SiteNav />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <PricingPlansSection pricing={pricing} billingContext={billingContext} />
        <FAQSection />
        <EmailCTASection />
        <FinalCTASection />
      </main>
      <SiteFooter />
    </div>
  );
}
