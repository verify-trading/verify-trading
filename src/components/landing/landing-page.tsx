import Link from "next/link";

import { Logo } from "@/components/site/logo";
import { SiteNav } from "@/components/site/site-nav";
import { getAppName } from "@/lib/site-config";

function FeatureCard({
  title,
  description,
  badge,
}: {
  title: string;
  description: string;
  badge: string;
}) {
  return (
    <div className="rounded-[28px] border border-[color:var(--vt-border)] bg-[var(--vt-card)] p-6 shadow-[0_20px_50px_rgba(10,13,46,0.28)]">
      <div className="inline-flex rounded-full border border-[rgba(76,110,245,0.24)] bg-[rgba(76,110,245,0.08)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--vt-blue)]">
        {badge}
      </div>
      <h3 className="mt-5 text-xl font-black tracking-[-0.04em] text-white sm:text-2xl">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:leading-7">{description}</p>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--vt-navy)] text-white">
      <SiteNav />
      <main>
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 pb-16 pt-12 sm:gap-14 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="inline-flex rounded-full border border-[rgba(242,109,109,0.24)] bg-[rgba(242,109,109,0.08)] px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-[var(--vt-coral)]">
              Launching 6 June 2026
            </div>
            <h1 className="mt-6 text-4xl font-black tracking-[-0.08em] text-white sm:text-5xl md:text-6xl">
              The Bloomberg Terminal for retail traders.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-slate-300">
              {getAppName()} routes every Ask prompt into the right system: live
              market data, seeded verification, deterministic calculators, chart
              analysis, and projection modelling.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/ask"
                className="rounded-full bg-[var(--vt-coral)] px-6 py-3 text-sm font-bold text-white shadow-[0_16px_44px_rgba(242,109,109,0.28)] transition hover:brightness-105"
              >
                Open Ask
              </Link>
              <Link
                href="/markets"
                className="rounded-full border border-[color:var(--vt-border)] px-6 py-3 text-sm font-bold text-white transition hover:bg-white/5"
              >
                View Markets
              </Link>
            </div>
          </div>

          <div className="rounded-[36px] border border-[color:var(--vt-border)] bg-[rgba(15,19,64,0.82)] p-8 shadow-[0_28px_90px_rgba(76,110,245,0.18)]">
            <div className="flex items-center gap-3">
              <Logo large />
            </div>
            <div className="mt-8 space-y-3">
              {[
                "Is Pepperstone safe to deposit with?",
                "What is Gold doing before London open?",
                "Lot size 1% risk £10k 20 pip stop",
              ].map((prompt, index) => (
                <div
                  key={prompt}
                  className={`rounded-3xl px-4 py-3 text-sm font-semibold ${
                    index % 2 === 0
                      ? "ml-auto max-w-[80%] rounded-br-md bg-[var(--vt-coral)] text-white"
                      : "max-w-[85%] rounded-tl-md border border-[color:var(--vt-border)] bg-[var(--vt-card-alt)] text-slate-200"
                  }`}
                >
                  {prompt}
                </div>
              ))}
            </div>
            <div className="mt-8 rounded-[28px] border border-[color:var(--vt-border)] bg-[var(--vt-card)] p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--vt-blue)]">
                Ask Pipeline
              </div>
              <div className="mt-3 space-y-2 text-sm leading-7 text-slate-300">
                <div>Claude supervises.</div>
                <div>Twelve Data handles live market context.</div>
                <div>Seeded entities handle broker, prop firm, and guru checks.</div>
                <div>Backend engines handle exact maths.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 pb-20 sm:px-6 lg:grid-cols-3">
          <FeatureCard
            badge="Verification"
            title="Seeded trust layer"
            description="Broker, prop-firm, and guru checks are grounded in the client dataset first. Unknown names fail safely instead of bluffing."
          />
          <FeatureCard
            badge="Market Data"
            title="Live briefing path"
            description="Twelve Data powers supported assets. Claude formats the answer, but the market numbers come from the data feed."
          />
          <FeatureCard
            badge="Math Engine"
            title="Deterministic outputs"
            description="Lot size and projection cards are generated from backend formulas, not guessed in the model’s prose."
          />
        </section>
      </main>
    </div>
  );
}

