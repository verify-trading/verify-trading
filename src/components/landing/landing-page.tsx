"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Shield,
  Calculator,
  TrendingUp,
  Mail,
  ChevronDown,
  Upload,
  Scale,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PricingPlansSection } from "@/components/pricing/pricing-plans";
import { Logo } from "@/components/site/logo";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import type { PublicBillingPricing } from "@/lib/billing/config";
import type { PricingPageBillingContext } from "@/lib/billing/pricing-page-data";
import { FREE_DAILY_ASK_LIMIT } from "@/lib/rate-limit/usage";
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

function HeroSection() {
  const appName = getAppName();

  return (
    <section className="border-b border-white/[0.06] bg-[radial-gradient(ellipse_90%_70%_at_100%_35%,rgba(76,110,245,0.1),transparent_52%),var(--vt-navy)] max-md:bg-[radial-gradient(ellipse_100%_60%_at_50%_0%,rgba(76,110,245,0.1),transparent_45%),var(--vt-navy)]">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-4 py-14 sm:px-6 sm:py-20 md:grid-cols-2 md:items-center md:gap-12 lg:gap-16 lg:py-24">
        <div className="order-2 min-w-0 max-w-2xl text-left md:order-1">
          <h1 className="text-4xl font-bold tracking-[-0.03em] text-white sm:text-5xl sm:leading-[1.08]">
            <span className="block">
              verify<span className="text-[var(--vt-coral)]">.</span>
            </span>
            <span className="mt-1 block">Before You Trade</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-400 sm:text-[17px] sm:leading-8">
            {appName} helps you verify brokers, validate trades, and manage risk with live market data and
            purpose-built tools, so you get clear, actionable answers before you trade.
          </p>
          <div className="mt-8">
            <Button asChild variant="default" size="pill" className="px-6">
              <Link href="/ask" prefetch={false}>
                VERIFY TRADE NOW
              </Link>
            </Button>
          </div>
          <p className="mt-5 text-xs leading-relaxed text-slate-500">
            <Link
              href="/privacy"
              className="font-semibold text-slate-400 underline decoration-white/20 underline-offset-2 transition hover:text-white"
            >
              Privacy policy
            </Link>
            <span className="mx-2 text-slate-600" aria-hidden>
              ·
            </span>
            <Link
              href="/terms"
              className="font-semibold text-slate-400 underline decoration-white/20 underline-offset-2 transition hover:text-white"
            >
              Terms of use
            </Link>
          </p>
          <ul className="mt-8 flex flex-col gap-2 text-sm text-slate-500 sm:flex-row sm:flex-wrap sm:gap-x-8 sm:gap-y-2">
            {["Stop bad trades in seconds", "Avoid any scams", "Control your risk"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 shrink-0 text-[var(--vt-green)]" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="order-1 min-w-0 md:order-2">
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-[var(--vt-navy)] shadow-[0_24px_64px_-28px_rgba(0,0,0,0.55),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
            <video
              className="h-full w-full object-cover [filter:brightness(0.97)_saturate(0.92)]"
              src="/main-video.mp4"
              autoPlay
              loop
              muted
              playsInline
              aria-label={`${appName} product preview`}
            />
            {/* Vignette + edge blend into page navy */}
            <div
              className="pointer-events-none absolute inset-0 z-[1] rounded-2xl shadow-[inset_0_0_72px_20px_rgba(10,13,46,0.75)]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 z-[2] rounded-2xl bg-gradient-to-b from-[rgba(10,13,46,0.5)] via-transparent to-[rgba(10,13,46,0.45)]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 z-[3] rounded-2xl bg-gradient-to-r from-[rgba(10,13,46,0.25)] via-transparent to-transparent max-md:bg-gradient-to-b max-md:from-[rgba(10,13,46,0.35)] max-md:via-transparent max-md:to-[rgba(10,13,46,0.2)]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 z-[4] rounded-2xl ring-1 ring-inset ring-white/[0.05]"
              aria-hidden
            />
          </div>
        </div>
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
          deterministic maths—the only AI that thinks like a trader.
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
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
            Before You Trade — Read This
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-400">
            A step-by-step guide to verifying trades, avoiding risk, and using every feature in seconds.
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
                  <Link href="/signup">
                    Create free account
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="pill" className="px-6">
                  <Link href="/ask" prefetch={false}>
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
  return (
    <div className="min-h-screen bg-[var(--vt-navy)] text-white">
      <SiteNav />
      <main>
        <HeroSection />
        <HowItWorksSection />
        <FeaturesSection />
        <PricingPlansSection pricing={pricing} billingContext={billingContext} />
        <FAQSection />
        <EmailCTASection />
        <FinalCTASection />
      </main>
      <SiteFooter />
    </div>
  );
}
