import type { Metadata } from "next";
import { Check, FileText, Gavel, Landmark, Link2, MessagesSquare, RefreshCw, Scale, ShieldCheck, X } from "lucide-react";

import { APP_ICONS, type AppIconKey } from "@/components/icons/app-icons";
import { MethodologyModels } from "@/components/marketing/methodology-models";
import { Breadcrumbs, CtaBand, FaqSection, PageHero, Section } from "@/components/marketing/primitives";
import { getAppName } from "@/lib/site-config";
import { cn } from "@/lib/utils";

const path = "/methodology";

export const metadata: Metadata = {
  title: "How We Verify Brokers & Prop Firms",
  description: `How ${getAppName()} assesses brokers, prop firms and trading educators: our funding model, data sources, assessment rules and the limits of what any record can tell you.`,
  alternates: { canonical: path },
};

const card = "rounded-2xl border border-white/[0.08] bg-[linear-gradient(160deg,rgba(76,110,245,0.09),rgba(255,255,255,0.015)_55%)]";
const iconTile = "flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--vt-blue)]/15 text-[#8fa5ff]";

const RULES = [
  { icon: ShieldCheck, title: "Independent", body: "No income from any entity we rate. A record cannot be bought, improved or removed by its subject." },
  { icon: Scale, title: "Consistent", body: "Assessments follow a fixed, rule-based model. The same facts produce the same result for every entity." },
  { icon: Link2, title: "Sourced", body: "We do not record a negative finding against a named party without a documented, official source, which we cite." },
  { icon: RefreshCw, title: "Current", body: "Records are reviewed on a rolling basis and revised as circumstances change. A record reflects the latest review, not a permanent label." },
];

const STEPS = [
  { title: "Collect", body: "Regulator registers, warning lists, enforcement records and the firm's own published terms." },
  { title: "Apply the model", body: "The same fixed rules run for every entity in a category. No manual nudging." },
  { title: "Show the source", body: "Every finding links to the regulator entry or document behind it." },
  { title: "Review and update", body: "Records are re-checked on a rolling basis and each shows its latest review date." },
];

const SOURCES = [
  { icon: Landmark, title: "Official regulators", body: "Public registers and warning lists (e.g. the FCA register and unauthorised-firm warnings) and equivalent authorities." },
  { icon: Gavel, title: "Public enforcement records", body: "Documented court actions, sanctions and regulatory decisions." },
  { icon: FileText, title: "Firm-published terms", body: "Operators' own published rules, leverage and licensing claims." },
  { icon: MessagesSquare, title: "Documented complaint patterns", body: "Public, attributable records of withdrawal and payout issues, assessed for pattern, not isolated reports." },
];

const COMPARISON: Array<[string, string, string]> = [
  ["Who pays", "Listed firms, via commission", "Traders, via subscription"],
  ["Built-in incentive", "Recommend a sign-up", "Report the record, good or bad"],
  ["Changing a record", "Commercial relationship", "Only with a primary source"],
];

const LIMITS = [
  "A high score is an assessment of documented evidence, not a guarantee of future conduct or safety.",
  "An \u201cUnverified\u201d educator is not accused of anything. It means no confirmed record exists either way.",
  "Records reflect information available at the last review; circumstances can change between reviews.",
  "We assess entities against documented criteria. We do not, and cannot, predict whether any individual trade or account will be profitable.",
  "Nothing on the platform is financial advice or a personal recommendation.",
];

const PLATFORM: Array<{ icon: AppIconKey; name: string; tier: string; body: string }> = [
  { icon: "verify", name: "Verification checks", tier: "Free", body: "Check any broker, prop firm or educator against our records. The verdict itself is never behind a paywall." },
  { icon: "markets", name: "Markets & economic calendar", tier: "Pro", body: "Session context and a high-impact news calendar, including the events most prop firm rules restrict trading around." },
  { icon: "journal", name: "Trading journal", tier: "Pro", body: "Auto-imported trades and performance analytics, so you can see what's actually working over time." },
  { icon: "mind", name: "Psychology tracking", tier: "Pro", body: "Patterns in your own behaviour (overtrading, revenge trading, tilt after losses) surfaced before they cost you." },
  { icon: "ask", name: "Deeper analysis (Ask)", tier: "Free · Pro", body: "Ask questions about any entity and get sourced answers. Free users get a daily allowance; Pro raises it." },
];

const FAQS = [
  {
    q: "Is this financial advice?",
    a: "No. We publish verification records and factual analysis to help you make your own informed decisions. We do not tell you what to trade, buy or sell, and nothing on the platform is a personal recommendation.",
  },
  {
    q: "How are you different from review and comparison sites?",
    a: "Most comparison sites are paid by the firms they rank. We take no affiliate commissions, rated entities can't be our affiliates, and verdicts aren't for sale. Records come from regulators and primary sources with citations, not marketing copy.",
  },
  {
    q: "Why don't you give educators a numeric score?",
    a: "A person isn't a balance sheet, and a decimal would imply precision we don't have. Educators get one of three plain labels instead (Verified, Unverified or Caution), based only on whether an independently verified track record exists, or a documented action does.",
  },
  {
    q: "Does a \u201cCaution\u201d status mean a firm or person is a scam?",
    a: "No. Caution means there's a documented regulator or court action on file, with the official citation shown. It's a prompt to read the source and judge for yourself, not a verdict that something is a scam. Equally, the absence of a Caution is not an endorsement.",
  },
  {
    q: "Do paid features change a verdict?",
    a: "Never. A status or band is computed from the records and can't be bought. Paid plans unlock tools, but they don't move a single verdict.",
  },
  {
    q: "Can a firm get its record changed?",
    a: "Only with evidence. A firm or individual can request a correction by sending a primary source, such as a register entry or a court document. Payment, pressure or advertising never changes a record.",
  },
];

/** Hero visual: the four rules every record follows. */
function RulesCard() {
  return (
    <div className="rounded-3xl bg-[linear-gradient(135deg,rgba(242,109,109,0.6),rgba(139,92,246,0.5)_50%,rgba(76,110,245,0.6))] p-px shadow-[0_0_60px_rgba(76,110,245,0.18)]">
      <div className="rounded-[calc(1.5rem-1px)] bg-[linear-gradient(160deg,#151a4f,var(--vt-navy)_70%)] p-6 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--vt-coral)]">Four rules, no exceptions</p>
        <ul className="mt-5 space-y-4">
          {RULES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3.5">
              <span className={iconTile}>
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-[15px] font-semibold text-white">{title}</p>
                <p className="mt-0.5 text-sm leading-6 text-slate-400">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function MethodologyPage() {
  const app = getAppName();
  return (
    <>
      <Breadcrumbs crumbs={[{ name: "Methodology", path }]} />
      <PageHero
        eyebrow="Methodology"
        title={
          <>
            How every verdict <span className="block text-[var(--vt-coral)]">is reached.</span>
          </>
        }
        lede="This page documents how we assess brokers, prop firms and trading educators: what we measure, where our data comes from, the limits of what we can know, and how a record can be challenged."
        primary={{ label: "Run a free check", href: "/ask", event: "ask" }}
        secondary={{ label: "Request a correction", href: "/contact" }}
        visual={<RulesCard />}
        location="methodology"
      >
        <p className="mt-6 text-xs uppercase tracking-[0.15em] text-white/40">Last reviewed October 2026</p>
      </PageHero>

      <Section
        eyebrow="The process"
        title="From public record to verdict"
        intro="Every record on the platform goes through the same four steps."
      >
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {STEPS.map((s, i) => (
            <li key={s.title} className={cn(card, "flex gap-4 p-5 sm:block sm:p-6")}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--vt-coral)]/40 bg-[var(--vt-coral)]/10 text-sm font-semibold tabular-nums text-[var(--vt-coral)]">
                {i + 1}
              </span>
              <div>
                <h3 className="text-base font-semibold text-white sm:mt-4">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-400">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        eyebrow="What we assess"
        title="Three categories, assessed differently"
        intro="Brokers, prop firms and educators carry different risks, so each has its own criteria."
        band
      >
        <MethodologyModels />
      </Section>

      <Section eyebrow="Data sources" title="Where our information comes from" intro="Assessments draw on documented, verifiable sources, not anonymous reviews alone.">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {SOURCES.map(({ icon: Icon, title, body }) => (
            <li key={title} className={cn(card, "flex gap-4 p-5 sm:block sm:p-6")}>
              <span className={iconTile}>
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-base font-semibold text-white sm:mt-4">{title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-400">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section eyebrow="Funding & independence" title="How we're funded" band>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-center lg:gap-12">
          <div className="space-y-4 text-[15px] leading-7 text-slate-300">
            <p>
              {app} earns revenue from user subscriptions. We do not accept affiliate commissions, referral fees,
              discount-code revenue or paid placements from any broker, prop firm or educator listed on the platform.
              No rated entity can pay to change, improve or remove its record.
            </p>
            <p>
              This matters because most broker and prop firm review sites operate on affiliate revenue: they earn a
              commission when a reader signs up with a listed firm. That model creates an incentive to recommend, not to warn.
              Our subscription model removes that incentive:{" "}
              <strong className="font-semibold text-white">
                our assessment is independent of any commercial relationship with the entities we assess.
              </strong>
            </p>
          </div>
          <div className={cn(card, "overflow-hidden")}>
            <div className="hidden grid-cols-[1.1fr_1fr_1fr] border-b border-white/[0.08] text-xs font-semibold uppercase tracking-wider sm:grid">
              <span className="p-4 text-slate-500" />
              <span className="p-4 text-slate-400">Affiliate-funded review site</span>
              <span className="p-4 text-[var(--vt-coral)]">{app}</span>
            </div>
            {COMPARISON.map(([row, them, us]) => (
              <div key={row} className="border-b border-white/[0.06] p-4 text-sm last:border-0 sm:grid sm:grid-cols-[1.1fr_1fr_1fr] sm:p-0">
                <span className="block font-medium text-white sm:p-4">{row}</span>
                <span className="mt-2 flex items-start gap-2 text-slate-400 sm:mt-0 sm:p-4">
                  <X className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
                  <span><span className="text-slate-500 sm:hidden">Review sites: </span>{them}</span>
                </span>
                <span className="mt-1.5 flex items-start gap-2 text-slate-200 sm:mt-0 sm:p-4">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden />
                  <span><span className="text-slate-500 sm:hidden">{app}: </span>{us}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section eyebrow="Limitations" title="What this assessment does and doesn't tell you" intro="In the interest of transparency, the limits of our records.">
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
        intro="The verification above is free for everyone. Paid features do not affect any verdict: the methodology applies identically whether you pay or not."
        band
      >
        <ul className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {PLATFORM.map((f, i) => {
            const Icon = APP_ICONS[f.icon];
            // 5 cards: the last one spans the leftover space on 2- and 3-column layouts.
            return (
              <li key={f.name} className={cn(card, "p-5 sm:p-6", i === PLATFORM.length - 1 && "sm:col-span-2")}>
                <div className="flex items-center justify-between gap-3">
                  <span className={iconTile}>
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
