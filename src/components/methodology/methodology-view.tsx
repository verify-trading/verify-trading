"use client";

import Link from "next/link";
import { useState } from "react";
import { Minus, Plus } from "lucide-react";

import { Logo } from "@/components/site/logo";
import { LEGAL_LINKS } from "@/lib/legal/legal-links";
import { getAppName } from "@/lib/site-config";
import { cn } from "@/lib/utils";

/* ─── Shared bits ─────────────────────────────────────────────────────────── */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-coral)]">
      {children}
    </p>
  );
}

function SectionHead({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
}) {
  return (
    <div className="max-w-2xl">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3 text-2xl font-bold tracking-[-0.02em] text-[#0a0d2e] sm:text-[2rem]">{title}</h2>
      {intro ? <p className="mt-3 text-[15px] leading-relaxed text-slate-500 sm:text-base">{intro}</p> : null}
    </div>
  );
}

const card = "rounded-2xl border border-slate-200/90 bg-white";
const dot = "inline-block size-2.5 shrink-0 rounded-full";

/* A factor row inside an assessment-model card: mono label + description. */
function FactorRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-slate-100 py-4 first:border-t-0 first:pt-0 sm:flex-row sm:gap-6">
      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--vt-coral)] sm:w-32 sm:shrink-0 sm:pt-0.5">
        {label}
      </span>
      <p className="text-sm leading-relaxed text-slate-600 sm:text-[15px]">{children}</p>
    </div>
  );
}

function AmberNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3.5 text-sm leading-relaxed text-amber-900">
      {children}
    </div>
  );
}

/* An assessment-model card. Category colour is a dot before the title — no left border. */
function ModelCard({
  title,
  subtitle,
  accent,
  children,
}: {
  title: string;
  subtitle: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(card, "p-6 sm:p-8")}>
      <div className="flex items-center gap-2.5">
        <span className={dot} style={{ backgroundColor: accent }} />
        <h3 className="text-xl font-bold tracking-tight text-[#0a0d2e]">{title}</h3>
      </div>
      <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-slate-400">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

/* ─── FAQ accordion ───────────────────────────────────────────────────────── */

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Is this financial advice?",
    a: "No. We publish verification records and factual analysis to help you make your own informed decisions. We do not tell you what to trade, buy or sell, and nothing on the platform is a personal recommendation.",
  },
  {
    q: "How are you different from review and comparison sites?",
    a: "Most comparison sites are paid by the firms they rank. We take no affiliate commissions, rated entities can't be our affiliates, and verdicts aren't for sale. Records come from regulators and primary sources with citations — not marketing copy.",
  },
  {
    q: "Why don't you give educators a numeric score?",
    a: "A person isn't a balance sheet, and a decimal would imply precision we don't have. Educators get one of three plain labels instead — Verified, Unverified, or Caution — based only on whether an independently verified track record exists, or a documented action does.",
  },
  {
    q: 'Does a "Caution" status mean a firm or person is a scam?',
    a: "No. Caution means there's a documented regulator or court action on file, with the official citation shown. It's a prompt to read the source and judge for yourself, not a verdict that something is a scam. Equally, the absence of a Caution is not an endorsement.",
  },
  {
    q: "Do paid features change a verdict?",
    a: "Never. A status or band is computed from the records and can't be bought. Paid plans unlock tools, but they don't move a single verdict.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const Icon = open ? Minus : Plus;
  return (
    <div className={cn(card, "overflow-hidden")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vt-blue)]/40 sm:px-6"
      >
        <span className="text-[15px] font-semibold leading-snug text-[#0a0d2e] sm:text-base">{q}</span>
        <Icon className="size-5 shrink-0 text-[var(--vt-coral)]" aria-hidden />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <p className="px-5 pb-5 text-sm leading-relaxed text-slate-600 sm:px-6 sm:text-[15px] sm:leading-7">{a}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Static data ─────────────────────────────────────────────────────────── */

const PRINCIPLES = [
  { name: "Independent", color: "var(--vt-coral)", text: "No income from any entity we rate. A record cannot be bought, improved or removed by its subject." },
  { name: "Consistent", color: "var(--vt-blue)", text: "Assessments follow a fixed, rule-based model. The same facts produce the same result for every entity." },
  { name: "Sourced", color: "var(--vt-green)", text: "We do not record a negative finding against a named party without a documented, official source — which we cite." },
  { name: "Current", color: "var(--vt-amber)", text: "Records are reviewed on a rolling basis and revised as circumstances change. A record reflects the latest review, not a permanent label." },
];

const DATA_SOURCES = [
  { name: "Official regulators", text: "Public registers and warning lists (e.g. the FCA register and unauthorised-firm warnings) and equivalent authorities." },
  { name: "Public enforcement records", text: "Documented court actions, sanctions and regulatory decisions." },
  { name: "Firm-published terms", text: "Operators' own published rules, leverage, and licensing claims." },
  { name: "Documented complaint patterns", text: "Public, attributable records of withdrawal and payout issues — assessed for pattern, not isolated reports." },
];

const PLATFORM = [
  { tag: "Free", pro: false, name: "Verification checks", text: "Check any broker, prop firm or educator against our records — a free daily allowance for everyone, with a higher limit on Pro. The verdict itself is never behind a paywall." },
  { tag: "Pro", pro: true, name: "Markets & economic calendar", text: "Session context and a high-impact news calendar — including the events most prop-firm rules restrict trading around." },
  { tag: "Pro", pro: true, name: "Trading journal", text: "Auto-imported trades and performance analytics, so you can see what's actually working over time." },
  { tag: "Pro", pro: true, name: "Psychology tracking", text: "Patterns in your own behaviour — overtrading, revenge trading, tilt after losses — surfaced before they cost you." },
  { tag: "Pro", pro: true, name: "Deeper analysis (Ask)", text: "Ask questions about any entity and get sourced answers. Free users get a daily allowance; Pro raises it." },
];

const LIMITATIONS = [
  <>A high score is an assessment of documented evidence, <strong className="font-semibold text-[#0a0d2e]">not a guarantee</strong> of future conduct or safety.</>,
  <>An &ldquo;Unverified&rdquo; educator is not accused of anything — it means no confirmed record exists either way.</>,
  <>Records reflect information available at the last review; circumstances can change between reviews.</>,
  <>We assess entities against documented criteria — we do not, and cannot, predict whether any individual trade or account will be profitable.</>,
  <>Nothing on the platform is financial advice or a personal recommendation.</>,
];

/* ─── Page ────────────────────────────────────────────────────────────────── */

export function MethodologyView() {
  const app = getAppName();
  return (
    <div className="min-h-dvh bg-[#f4f5f9] text-[#0a0d2e]">
      {/* Hero (dark) with its own minimal header */}
      <header className="relative overflow-hidden bg-[var(--vt-navy)] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-[28rem] rounded-full border border-white/[0.06]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 top-10 size-[20rem] rounded-full border border-[var(--vt-coral)]/10"
        />
        <div className="relative mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-6 sm:px-8">
          <Link href="/" className="flex items-center" aria-label={`${app} home`}>
            <Logo compact showWordmark />
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-white/70 transition hover:text-white"
          >
            ← Back to site
          </Link>
        </div>

        <div className="relative mx-auto w-full max-w-5xl px-5 pb-20 pt-10 sm:px-8 sm:pb-24 sm:pt-16">
          <Eyebrow>Methodology · How we verify</Eyebrow>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.05] tracking-[-0.03em] sm:text-6xl">
            How every verdict is reached.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
            This page documents how we assess brokers, prop firms and trading educators — what we measure,
            where our data comes from, the limits of what we can know, and how a record can be challenged.
          </p>
          <p className="mt-8 font-mono text-xs uppercase tracking-[0.15em] text-white/40">
            Last reviewed: June 2026
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-20 px-5 py-20 sm:space-y-24 sm:px-8 sm:py-24">
        {/* Funding & independence */}
        <section>
          <SectionHead eyebrow="Funding & independence" title="How we're funded" />
          <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-slate-600 sm:text-base sm:leading-7">
            {app} earns revenue from user subscriptions.{" "}
            <strong className="font-semibold text-[#0a0d2e]">
              We do not accept affiliate commissions, referral fees, discount-code revenue or paid
              placements from any broker, prop firm or educator listed on the platform.
            </strong>{" "}
            No rated entity can pay to change, improve or remove its record.
          </p>
          <div className={cn(card, "mt-6 bg-slate-50/70 p-5 sm:p-6")}>
            <p className="text-sm leading-relaxed text-slate-600 sm:text-[15px] sm:leading-7">
              This matters because most broker and prop-firm review sites operate on affiliate revenue — they
              earn a commission when a reader signs up with a listed firm. That model creates an incentive to
              recommend, not to warn. Our subscription model removes that incentive:{" "}
              <strong className="font-semibold text-[#0a0d2e]">
                our assessment is independent of any commercial relationship with the entities we assess.
              </strong>
            </p>
          </div>
        </section>

        {/* Principles */}
        <section>
          <SectionHead
            eyebrow="Principles"
            title="The rules behind every record"
            intro="These apply to every entity on the platform, without exception."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {PRINCIPLES.map((p) => (
              <div key={p.name} className={cn(card, "p-5 sm:p-6")}>
                <div className="flex items-center gap-2.5">
                  <span className={dot} style={{ backgroundColor: p.color }} />
                  <h3 className="text-base font-bold text-[#0a0d2e]">{p.name}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{p.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Assessment models */}
        <section>
          <SectionHead
            eyebrow="Assessment models"
            title="Three categories, assessed differently"
            intro="Brokers, prop firms and educators carry different risks, so each is assessed on its own criteria. These are the factors every assessment in that category considers."
          />
          <div className="mt-8 space-y-5">
            <ModelCard title="Brokers" subtitle="Regulation-led" accent="var(--vt-green)">
              <div>
                <FactorRow label="Regulation">
                  Which authority licenses the entity, and at what tier. Top-tier oversight (e.g. FCA, ASIC) counts
                  for far more than offshore registration — it&rsquo;s the single most important factor we consider.
                </FactorRow>
                <FactorRow label="Fund safety">
                  Client-money protections: segregation of funds, compensation-scheme coverage, and the treatment
                  of client money in the event of firm failure.
                </FactorRow>
                <FactorRow label="Withdrawals">
                  Documented withdrawal and complaint patterns from public and regulatory sources.
                </FactorRow>
                <FactorRow label="History">Length and consistency of operating history.</FactorRow>
                <FactorRow label="Sanctions">
                  Any regulatory sanctions, warnings or enforcement actions on record.
                </FactorRow>
              </div>
              <AmberNote>
                <strong className="font-semibold">A signal we take seriously:</strong> where a broker advertises
                leverage exceeding what a top-tier regulator legally permits, this typically indicates clients are
                onboarded to an offshore entity. In that case we assess the offshore entity, not the regulated
                brand name.
              </AmberNote>
            </ModelCard>

            <ModelCard title="Prop firms" subtitle="Stability & payout reliability" accent="var(--vt-blue)">
              <div>
                <FactorRow label="Payouts">
                  Documented payout reliability — the central question for a funded trader.
                </FactorRow>
                <FactorRow label="Stability">
                  Ownership transparency, operating history and any history of closure or restructuring.
                </FactorRow>
                <FactorRow label="Rule fairness">
                  Whether trading rules are clearly stated and consistently applied, versus structured to enable
                  payout denial on technicalities.
                </FactorRow>
              </div>
              <AmberNote>
                <strong className="font-semibold">Automatic classification:</strong> a prop firm confirmed to have
                ceased operations is recorded as <strong className="font-semibold">Avoid</strong>, irrespective of
                prior reputation.
              </AmberNote>
            </ModelCard>

            <ModelCard
              title={'Educators & "gurus"'}
              subtitle="Status classification · no numeric score"
              accent="var(--vt-coral)"
            >
              <p className="text-sm leading-relaxed text-slate-600 sm:text-[15px]">
                Individuals are <strong className="font-semibold text-[#0a0d2e]">not</strong> assigned a numeric
                score. We report one factual question — whether an independently verified track record exists — and
                place each in one of three statuses:
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-4">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                    Verified
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    An independently confirmed track record exists and has been reviewed.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-100/70 p-4">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Unverified
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    No confirmed record either way. The neutral default — not a negative finding.
                  </p>
                </div>
                <div className="rounded-xl border border-rose-200/70 bg-rose-50/70 p-4">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--vt-coral)]">
                    Caution
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Applied only where documented regulator or court action exists, with the source cited.
                  </p>
                </div>
              </div>
              <AmberNote>
                <strong className="font-semibold">What we exclude:</strong> we do not classify individuals on the
                basis of rumour, social-media allegations or competitor claims. The absence of a verified record is
                reported as exactly that — not as evidence of wrongdoing.
              </AmberNote>
            </ModelCard>
          </div>
        </section>

        {/* Data sources */}
        <section>
          <SectionHead
            eyebrow="Data sources"
            title="Where our information comes from"
            intro="Assessments draw on documented, verifiable sources — not anonymous reviews alone."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {DATA_SOURCES.map((s) => (
              <div key={s.name} className={cn(card, "p-5 sm:p-6")}>
                <h3 className="text-base font-bold text-[#0a0d2e]">{s.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Limitations */}
        <section>
          <SectionHead eyebrow="Limitations" title="What this assessment does — and doesn't — tell you" />
          <div className="mt-6 rounded-2xl border border-slate-200/90 bg-[#eef0f6]/70 p-6 sm:p-8">
            <p className="text-[15px] leading-relaxed text-slate-600">In the interest of transparency, the limits of our records:</p>
            <ul className="mt-5 space-y-4">
              {LIMITATIONS.map((item, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
                  <span className="select-none text-[var(--vt-coral)]">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* The platform */}
        <section>
          <SectionHead
            eyebrow="The platform"
            title={`What you can do with ${app}`}
            intro="The verification above is free for everyone. These are the tools the platform offers on top of it."
          />
          <div className="mt-6 rounded-xl border border-slate-200/90 bg-slate-50/70 px-4 py-3.5 text-sm leading-relaxed text-slate-600">
            <strong className="font-semibold text-[#0a0d2e]">Note:</strong> paid features do not affect any verdict.
            Verification is independent of, and unchanged by, your subscription. The methodology above applies
            identically whether you pay or not.
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PLATFORM.map((f) => (
              <div key={f.name} className={cn(card, "flex flex-col p-5")}>
                <span
                  className={cn(
                    "inline-flex w-fit items-center rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em]",
                    f.pro
                      ? "bg-[var(--vt-blue)]/10 text-[var(--vt-blue)]"
                      : "bg-emerald-500/10 text-emerald-600",
                  )}
                >
                  {f.tag}
                </span>
                <h3 className="mt-3 text-base font-bold text-[#0a0d2e]">{f.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section>
          <SectionHead eyebrow="Common questions" title="Frequently asked" />
          <div className="mt-8 space-y-3">
            {FAQS.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden rounded-[2rem] bg-[#0a1126] px-6 py-14 text-center text-white shadow-[0_30px_80px_-50px_rgba(10,17,38,0.6)] ring-1 ring-inset ring-white/10 sm:px-10 sm:py-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_110%_at_10%_0%,rgba(76,110,245,0.28),transparent_55%),radial-gradient(120%_120%_at_90%_100%,rgba(242,109,109,0.18),transparent_55%)]"
          />
          <div className="relative">
            <h2 className="text-2xl font-bold tracking-[-0.02em] sm:text-3xl">Check any name for free</h2>
            <p className="mx-auto mt-3 max-w-md text-base text-white/70">
              See the record for yourself — before your money moves.
            </p>
            <Link
              href="/ask"
              prefetch={false}
              className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-semibold text-[#0a0d2e] transition hover:bg-white/90"
            >
              Run your first check →
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 px-5 py-10 sm:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 text-center">
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-[#0a0d2e]">{app}</span> · Independent trading verification
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-500">
            <Link href="/" className="transition hover:text-[#0a0d2e]">Home</Link>
            <Link href="/methodology" className="transition hover:text-[#0a0d2e]">How we verify</Link>
            {LEGAL_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="transition hover:text-[#0a0d2e]">
                {link.shortLabel}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
