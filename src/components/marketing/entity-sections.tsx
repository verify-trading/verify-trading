import Link from "next/link";
import { ExternalLink, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

import { Faq } from "@/components/marketing/primitives";
import { EntityAvatar, formatRecordDate, ScoreBar, VerdictBadge } from "@/components/marketing/entity-ui";
import { JsonLd } from "@/components/seo/json-ld";
import { entityPath } from "@/lib/compare/insights";
import type { PublicEntity, RegulatorRef, Verdict } from "@/lib/compare/entities";
import { STANDING_LABEL, getRegulator, type Standing } from "@/lib/compare/regulators";
import { cn } from "@/lib/utils";

/** What each BTS verdict means, in the approved method's words. No claims beyond the rule. */
export const BAND_INFO: Array<{ verdict: Verdict; text: string }> = [
  { verdict: "Verified", text: "Score 75+, research complete, and an active tier 1 or 2 licence held by the entity serving retail clients." },
  { verdict: "Record reviewed", text: "Prop firms scoring 75+ with research complete and no adverse findings. A reviewed record, not an endorsement or a guarantee of payouts." },
  { verdict: "Caution", text: "Active, with enough evidence to score, but short of the top band. Read the reason before you deposit." },
  { verdict: "High risk", text: "Verified adverse evidence only: a regulator warning, or a licence revoked or suspended in the last 2 years." },
  { verdict: "Insufficient data", text: "Not enough verified evidence yet to rate. Not a judgement either way." },
  { verdict: "Under review", text: "Our researchers are re-checking this record. No score is shown until they finish." },
  { verdict: "Not active", text: "Inactive, redirected or merged. No score is shown." },
];

/** Separate scale for people: no numeric score, three tiers, each one defensible. */
export const GURU_BAND_INFO: Array<{ verdict: Verdict; text: string }> = [
  { verdict: "Verified", text: "A public track record we have independently confirmed. Not an endorsement of any strategy." },
  { verdict: "Unverified", text: "The neutral default. Record is published but no verified track record is on file. Not an accusation." },
  { verdict: "Caution", text: "A documented regulator or court action is on file, with the source cited on the record." },
];

const barTone: Record<string, string> = {
  Verified: "bg-[var(--vt-green)]",
  Caution: "bg-[var(--vt-amber)]",
  "High risk": "bg-[var(--vt-coral)]",
};

/** The verdict scale: hairline-separated rows, one line per band. */
export function VerdictBands({ current, counts, gurus = false, propFirms = false }: { current?: Verdict; counts?: Partial<Record<Verdict, number>>; gurus?: boolean; propFirms?: boolean }) {
  // Brokers pass as "Verified", prop firms as "Record reviewed".
  const bands = gurus ? GURU_BAND_INFO : BAND_INFO.filter((b) => b.verdict !== (propFirms ? "Verified" : "Record reviewed"));
  return (
    <ul className="divide-y divide-white/10 border-y border-white/10">
      {bands.map((b) => (
        <li
          key={b.verdict}
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 py-3 transition-colors",
            current === b.verdict && "font-medium",
          )}
          aria-current={current === b.verdict ? "true" : undefined}
        >
          <div className="flex items-center gap-2.5">
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", barTone[b.verdict] ?? "bg-slate-500")} />
            <VerdictBadge verdict={b.verdict} />
            {current === b.verdict ? <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--vt-coral)]">This record</span> : null}
          </div>
          <p className="min-w-0 flex-1 text-xs text-slate-400 sm:text-right sm:text-sm">{b.text}</p>
          {counts ? <span className="font-mono text-xs text-slate-400">{(counts[b.verdict] ?? 0).toLocaleString("en-GB")}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** A titled page block that the table of contents can link to. */
export function Block({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h2>
      {intro ? <p className="mt-2 max-w-2xl text-[15px] leading-7 text-slate-400">{intro}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Desktop: sticky rail. Mobile: a horizontal chip strip that sits under the summary. */
export function TocNav({ items }: { items: Array<{ id: string; label: string }> }) {
  return (
    <nav aria-label="On this page">
      <p className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 lg:block">On this page</p>
      <ol className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:mt-3 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden">
        {items.map((i, n) => (
          <li key={i.id} className="shrink-0">
            <a
              href={`#${i.id}`}
              className="flex items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vt-blue)]/60 lg:rounded-md lg:border-0 lg:bg-transparent lg:px-2 lg:py-1.5 lg:text-[13px] lg:text-slate-400"
            >
              <span aria-hidden className="hidden w-4 font-mono text-[11px] text-slate-600 lg:inline">{n + 1}</span>
              {i.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

const standingTone: Record<Standing, string> = {
  major: "border-[var(--vt-green)]/40 bg-[var(--vt-green)]/10 text-[var(--vt-green)]",
  regional: "border-[var(--vt-blue)]/40 bg-[var(--vt-blue)]/10 text-[var(--vt-blue)]",
  offshore: "border-[var(--vt-amber)]/40 bg-[var(--vt-amber)]/10 text-[var(--vt-amber)]",
  registration: "border-white/15 bg-white/5 text-slate-300",
};

export function StandingBadge({ standing, className }: { standing: Standing; className?: string }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", standingTone[standing], className)}>{STANDING_LABEL[standing]}</span>;
}

/** One listed regulator: hairline row. */
export function RegulatorCard({ r, entity }: { r: RegulatorRef; entity: PublicEntity }) {
  const ref = r.slug ? getRegulator(r.slug) : null;
  const isFcaRef = r.code === "FCA" && entity.fcaRegistered && entity.fcaReference;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">{ref ? ref.name : r.code}</h3>
          <span className="font-mono text-xs text-slate-400">({r.code})</span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">{ref?.country ?? r.country ?? "Country not recorded"}</p>
      </div>
      <div className="flex items-center gap-3">
        {ref ? <StandingBadge standing={ref.standing} /> : null}
        {ref?.registerUrl ? (
          <a
            href={ref.registerUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-300 transition-colors hover:text-white"
          >
            {ref.registerLabel} <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : null}
        {isFcaRef ? (
          <span className="font-mono text-xs text-slate-400" title={`Ref: ${entity.fcaReference}`}>
            Ref: {entity.fcaReference}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function WarningBanner({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="note" className="flex gap-3 border-l-2 border-[var(--vt-coral)] bg-[var(--vt-coral)]/[0.06] p-4">
      <ShieldAlert className="mt-0.5 size-5 shrink-0 text-[var(--vt-coral)]" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{title}</p>
        <div className="mt-1 text-sm leading-relaxed text-slate-300">{children}</div>
      </div>
    </div>
  );
}

/** Compact record row for alternatives (hairline row). */
export function EntityMiniCard({ e, note }: { e: PublicEntity; note?: string }) {
  return (
    <Link
      href={entityPath(e)}
      className="group flex items-center justify-between gap-3 py-3.5 transition-colors hover:bg-white/[0.02]"
    >
      <div className="flex items-center gap-3 min-w-0">
        <EntityAvatar name={e.name} verdict={e.verdict} className="size-8 text-xs" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white group-hover:text-[var(--vt-coral)] transition-colors">{e.name}</p>
          <p className="truncate text-xs text-slate-500">{note ?? (e.regulators.length ? e.regulators.slice(0, 3).join(", ") : `Updated ${formatRecordDate(e.updatedAt)}`)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        <VerdictBadge verdict={e.verdict} className="px-2 py-0.5 text-[11px]" />
        <ScoreBar entity={e} className="hidden w-20 shrink-0 sm:block" />
      </div>
    </Link>
  );
}

/** Visible FAQ plus FAQPage JSON-LD built from the same items (max 5 items). */
export function FaqBlock({ items }: { items: Array<{ q: string; a: string }> }) {
  const visible = items.slice(0, 5);
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: visible.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }}
      />
      <Faq items={visible} />
    </>
  );
}
