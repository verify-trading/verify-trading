import type { Metadata } from "next";
import { FileText, Gavel, Landmark, Link2, MessagesSquare, RefreshCw, Scale, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { APP_ICONS, type AppIconKey } from "@/components/icons/app-icons";
import { Breadcrumbs, CardGrid, CtaBand, FaqSection, PageHero, Section } from "@/components/marketing/primitives";
import { getAppName } from "@/lib/site-config";
import { cn } from "@/lib/utils";

const path = "/methodology";

export const metadata: Metadata = {
  title: "How We Verify Brokers & Prop Firms",
  description: `How ${getAppName()} assesses brokers, prop firms and trading educators: our funding model, data sources, assessment rules and the limits of what any record can tell you.`,
  alternates: { canonical: path },
};

const card = "rounded-2xl border border-white/[0.08] bg-[linear-gradient(160deg,rgba(76,110,245,0.09),rgba(255,255,255,0.015)_55%)]";

const PRINCIPLES = [
  { icon: ShieldCheck, title: "Independent", body: "No income from any entity we assess. A record can't be bought, improved or removed by its subject." },
  { icon: Scale, title: "Consistent", body: "Every entity is assessed against the same fixed rules. The same facts produce the same result, every time." },
  { icon: Link2, title: "Sourced", body: "No negative finding is recorded against a named party without a documented, official source, which we cite." },
  { icon: RefreshCw, title: "Current", body: "Records are reviewed on a rolling basis. Each one shows its latest review, not a permanent label." },
];

const SOURCES = [
  { icon: Landmark, title: "Official regulators", body: "Public registers and warning lists, such as the FCA register and unauthorised-firm warnings, and their equivalents abroad." },
  { icon: Gavel, title: "Public enforcement records", body: "Documented court actions, sanctions and regulatory decisions." },
  { icon: FileText, title: "Firm-published terms", body: "Each operator's own published rules, leverage and licensing claims, checked against the register." },
  { icon: MessagesSquare, title: "Documented complaint patterns", body: "Public, attributable withdrawal and payout issues, assessed for pattern rather than single reports." },
];

type Model = { tag: string; subtitle: string; dot: string; factors: Array<[string, string]>; note: ReactNode; extra?: ReactNode };

const EDUCATOR_STATUSES = [
  { label: "Verified", tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25", body: "An independently confirmed track record exists and has been reviewed." },
  { label: "Unverified", tone: "text-slate-300 bg-white/[0.04] border-white/10", body: "No confirmed record either way. The neutral default, not a negative finding." },
  { label: "Caution", tone: "text-[var(--vt-coral)] bg-[var(--vt-coral)]/10 border-[var(--vt-coral)]/30", body: "Only where a documented regulator or court action exists, with the source cited." },
];

const MODELS: Model[] = [
  {
    tag: "Brokers",
    subtitle: "Regulation-led",
    dot: "bg-emerald-400",
    factors: [
      ["Regulation", "Which authority licenses the entity, and at what tier. Top-tier oversight (FCA, ASIC) counts for far more than offshore registration."],
      ["Fund safety", "Segregation of client money, compensation-scheme cover and what happens to funds if the firm fails."],
      ["Withdrawals", "Documented withdrawal and complaint patterns from public and regulatory sources."],
      ["History", "Length and consistency of operating history."],
      ["Sanctions", "Any regulatory sanctions, warnings or enforcement actions on record."],
    ],
    note: (
      <>
        <strong className="font-semibold text-white">A signal we take seriously:</strong> leverage above what a top-tier regulator
        allows usually means clients are onboarded to an offshore entity. We then assess that entity, not the regulated brand.
      </>
    ),
  },
  {
    tag: "Prop firms",
    subtitle: "Stability and payout reliability",
    dot: "bg-[var(--vt-blue)]",
    factors: [
      ["Payouts", "Documented payout reliability, the central question for a funded trader."],
      ["Stability", "Ownership transparency, operating history and any closure or restructuring."],
      ["Rule fairness", "Whether rules are clearly stated and applied consistently, or written to deny payouts on technicalities."],
    ],
    note: (
      <>
        <strong className="font-semibold text-white">Automatic classification:</strong> a prop firm confirmed to have stopped
        operating is recorded as <strong className="font-semibold text-white">Avoid</strong>, whatever its earlier reputation.
      </>
    ),
  },
  {
    tag: "Educators & gurus",
    subtitle: "Status only, no numeric score",
    dot: "bg-[var(--vt-coral)]",
    factors: [],
    extra: (
      <>
        <p className="text-sm leading-6 text-slate-400">
          We answer one factual question, whether an independently verified track record exists, and give one of three statuses:
        </p>
        <ul className="mt-4 space-y-2.5">
          {EDUCATOR_STATUSES.map((s) => (
            <li key={s.label} className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
              <span className={cn("inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", s.tone)}>
                {s.label}
              </span>
              <p className="mt-1.5 text-sm leading-6 text-slate-400">{s.body}</p>
            </li>
          ))}
        </ul>
      </>
    ),
    note: (
      <>
        <strong className="font-semibold text-white">What we exclude:</strong> rumour, social-media allegations and competitor
        claims. No verified record is reported as exactly that, never as evidence of wrongdoing.
      </>
    ),
  },
];

const LIMITS = [
  "A high score reflects documented evidence. It is not a guarantee of future conduct or safety.",
  "An Unverified educator is not accused of anything. It means no confirmed record exists either way.",
  "Records reflect what was available at the last review, and circumstances can change between reviews.",
  "We assess entities against documented criteria. We can't predict whether any trade or account will be profitable.",
  "Nothing on the platform is financial advice or a personal recommendation.",
];

const PLATFORM: Array<{ icon: AppIconKey; name: string; tier: string; body: string }> = [
  { icon: "verify", name: "Verification checks", tier: "Free", body: "Check any broker, prop firm or educator against the record. The verdict is never behind a paywall." },
  { icon: "ask", name: "Ask", tier: "Free · Pro", body: "Ask about any broker, setup or market and get a sourced answer. 5 chats a day free, 20 on Pro." },
  { icon: "markets", name: "Markets", tier: "Free", body: "Live prices across gold, forex, indices and crypto." },
  { icon: "calendar", name: "Intelligence & calendar", tier: "Pro", body: "A daily pre-session brief and a high-impact news calendar, including the events prop firm rules restrict." },
  { icon: "journal", name: "Journal", tier: "Pro", body: "Log trades, spot patterns and run Challenge Mode against prop firm evaluations." },
  { icon: "mind", name: "Mind", tier: "Pro", body: "Spot overtrading, revenge trading and tilt in your own behaviour before they cost you." },
];

const FAQS = [
  {
    q: "How are you different from review and comparison sites?",
    a: "Most comparison sites are paid by the firms they rank. We take no affiliate commissions, rated entities can't be our affiliates and verdicts aren't for sale. Records come from regulators and primary sources, with citations.",
  },
  {
    q: "Why don't educators get a numeric score?",
    a: "A person isn't a balance sheet, and a decimal would imply precision we don't have. Educators get one of three plain statuses, Verified, Unverified or Caution, based only on whether a verified track record or a documented action exists.",
  },
  {
    q: "Does a Caution status mean a firm or person is a scam?",
    a: "No. Caution means a documented regulator or court action is on file, with the official citation shown. It's a prompt to read the source and judge for yourself. Equally, no Caution is not an endorsement.",
  },
  {
    q: "Can a firm get its record changed?",
    a: "Only with evidence. A firm or individual can request a correction by sending a primary source, such as a register entry or a court document. Payment, pressure or advertising never changes a record.",
  },
  {
    q: "Does paying for Pro change what I see?",
    a: "Pro unlocks more tools and a higher Ask limit. Every verdict and every record is the same on Free and Pro.",
  },
];

export default function MethodologyPage() {
  const app = getAppName();
  return (
    <>
      <Breadcrumbs crumbs={[{ name: "Methodology", path }]} />
      <PageHero
        eyebrow="Methodology"
        title={
          <>
            How every verdict
            <br className="hidden sm:block" /> <span className="text-[var(--vt-coral)]">is reached.</span>
          </>
        }
        lede="How we assess brokers, prop firms and trading educators: what we measure, where the data comes from, the limits of what we can know, and how a record can be challenged."
        primary={{ label: "Run a free check", href: "/ask", event: "ask" }}
        secondary={{ label: "Request a correction", href: "/contact" }}
        location="methodology"
      >
        <p className="mt-6 text-xs uppercase tracking-[0.15em] text-white/40">Last reviewed October 2026</p>
      </PageHero>

      <Section eyebrow="Funding & independence" title="How we're funded">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
          <div className="space-y-4 text-[15px] leading-7 text-slate-300">
            <p>
              {app} earns revenue from trader subscriptions.{" "}
              <strong className="font-semibold text-white">
                We take no affiliate commissions, referral fees, discount-code revenue or paid placements from any broker, prop
                firm or educator on the platform.
              </strong>
            </p>
            <p>No listed entity can pay to change, improve or remove its record.</p>
          </div>
          <div className={cn(card, "p-5 sm:p-6")}>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--vt-coral)]">Why it matters</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Most review sites earn a commission when a reader signs up with a listed firm, which rewards recommending over
              warning. A subscription model removes that incentive, so our assessment stays independent of the firms we assess.
            </p>
          </div>
        </div>
      </Section>

      <Section eyebrow="Standards" title="The rules behind every record" intro="These apply to every entity on the platform, without exception." band>
        <CardGrid items={PRINCIPLES} cols={2} />
      </Section>

      <Section
        eyebrow="Assessment models"
        title="Three categories, assessed differently"
        intro="Brokers, prop firms and educators carry different risks, so each is assessed on its own criteria."
      >
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
          {MODELS.map((m) => (
            <article key={m.tag} className={cn(card, "flex flex-col p-5 sm:p-6")}>
              <div className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", m.dot)} aria-hidden />
                <h3 className="text-lg font-semibold tracking-tight text-white">{m.tag}</h3>
              </div>
              <p className="mt-1 text-xs uppercase tracking-wider text-slate-500">{m.subtitle}</p>
              <div className="mt-5 flex-1">
                {m.factors.length ? (
                  <dl className="divide-y divide-white/[0.06]">
                    {m.factors.map(([label, body]) => (
                      <div key={label} className="py-3 first:pt-0">
                        <dt className="text-sm font-semibold text-white">{label}</dt>
                        <dd className="mt-1 text-sm leading-6 text-slate-400">{body}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {m.extra}
              </div>
              <p className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3.5 text-[13px] leading-6 text-slate-300">
                {m.note}
              </p>
            </article>
          ))}
        </div>
      </Section>

      <Section eyebrow="Data sources" title="Where our information comes from" intro="Documented, verifiable sources, not anonymous reviews." band>
        <CardGrid items={SOURCES} cols={2} />
      </Section>

      <Section eyebrow="Limits" title="What a record does and doesn't tell you">
        <ul className={cn(card, "divide-y divide-white/[0.06] px-5 sm:px-6")}>
          {LIMITS.map((l) => (
            <li key={l} className="flex gap-3 py-4 text-[15px] leading-7 text-slate-300">
              <span className="mt-[11px] size-1.5 shrink-0 rounded-full bg-[var(--vt-coral)]" aria-hidden />
              {l}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        eyebrow="The platform"
        title={`What you can do with ${app}`}
        intro="Verification is free for everyone, and the method above is the same whether you pay or not. These tools sit on top of it."
        band
      >
        <ul className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {PLATFORM.map((f) => {
            const Icon = APP_ICONS[f.icon];
            return (
              <li key={f.name} className={cn(card, "p-5 sm:p-6")}>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--vt-blue)]/15 text-[#8fa5ff]">
                    <Icon className="size-5" />
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                      f.tier === "Pro" ? "bg-violet-500/20 text-violet-300" : "bg-emerald-500/15 text-emerald-300",
                    )}
                  >
                    {f.tier}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-white">{f.name}</h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-400">{f.body}</p>
              </li>
            );
          })}
        </ul>
      </Section>

      <FaqSection items={FAQS} title="Frequently asked" schema={false} band={false} />

      <CtaBand
        title="Check any name for free"
        body="See the record for yourself before your money moves."
        primary={{ label: "Run your first check", href: "/ask", event: "ask" }}
        secondary={{ label: "Trust & independence", href: "/trust" }}
        location="methodology"
      />
    </>
  );
}
