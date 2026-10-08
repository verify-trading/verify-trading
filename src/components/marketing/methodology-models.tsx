"use client";

import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type Model = {
  key: string;
  tab: string;
  dot: string;
  subtitle: string;
  summary: string;
  noteLabel: string;
  note: ReactNode;
  factors?: Array<[string, string]>;
  statuses?: Array<{ label: string; tone: string; body: string }>;
};

const MODELS: Model[] = [
  {
    key: "brokers",
    tab: "Brokers",
    dot: "bg-emerald-400",
    subtitle: "Regulation-led",
    summary: "A broker holds your money, so who regulates it, and how well your funds are protected, matter most.",
    noteLabel: "A signal we take seriously",
    note: "Where a broker advertises leverage exceeding what a top-tier regulator legally permits, this typically indicates clients are onboarded to an offshore entity. In that case we assess the offshore entity, not the regulated brand name.",
    factors: [
      ["Regulation", "Which authority licenses the entity, and at what tier. Top-tier oversight (e.g. FCA, ASIC) counts for far more than offshore registration. It's the single most important factor we consider."],
      ["Fund safety", "Client-money protections: segregation of funds, compensation-scheme coverage, and the treatment of client money in the event of firm failure."],
      ["Withdrawals", "Documented withdrawal and complaint patterns from public and regulatory sources."],
      ["History", "Length and consistency of operating history."],
      ["Sanctions", "Any regulatory sanctions, warnings or enforcement actions on record."],
    ],
  },
  {
    key: "prop",
    tab: "Prop firms",
    dot: "bg-[var(--vt-blue)]",
    subtitle: "Stability and payout reliability",
    summary: "Prop firms usually aren't regulated like brokers, so we focus on what a funded trader actually needs: getting paid.",
    noteLabel: "Automatic classification",
    note: (
      <>
        A prop firm confirmed to have ceased operations is recorded as <strong className="font-semibold text-white">Avoid</strong>,
        irrespective of prior reputation.
      </>
    ),
    factors: [
      ["Payouts", "Documented payout reliability, the central question for a funded trader."],
      ["Stability", "Ownership transparency, operating history and any history of closure or restructuring."],
      ["Rule fairness", "Whether trading rules are clearly stated and consistently applied, versus structured to enable payout denial on technicalities."],
    ],
  },
  {
    key: "educators",
    tab: "Educators & gurus",
    dot: "bg-[var(--vt-coral)]",
    subtitle: "Status only, no numeric score",
    summary: "Individuals are not assigned a numeric score. We report one factual question, whether an independently verified track record exists, and place each in one of three statuses.",
    noteLabel: "What we exclude",
    note: "We do not classify individuals on the basis of rumour, social-media allegations or competitor claims. The absence of a verified record is reported as exactly that, not as evidence of wrongdoing.",
    statuses: [
      { label: "Verified", tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", body: "An independently confirmed track record exists and has been reviewed." },
      { label: "Unverified", tone: "border-white/15 bg-white/[0.05] text-slate-200", body: "No confirmed record either way. The neutral default, not a negative finding." },
      { label: "Caution", tone: "border-[var(--vt-coral)]/35 bg-[var(--vt-coral)]/10 text-[var(--vt-coral)]", body: "Applied only where documented regulator or court action exists, with the source cited." },
    ],
  },
];

const tile = "rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5";

/** Tabbed assessment models: one category at a time, so uneven factor counts never misalign columns. */
export function MethodologyModels() {
  const [active, setActive] = useState(MODELS[0].key);
  const m = MODELS.find((x) => x.key === active) ?? MODELS[0];

  return (
    <div>
      <div role="tablist" aria-label="Assessment model" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {MODELS.map((x) => {
          const on = x.key === active;
          return (
            <button
              key={x.key}
              type="button"
              role="tab"
              id={`model-tab-${x.key}`}
              aria-selected={on}
              aria-controls="model-panel"
              onClick={() => setActive(x.key)}
              className={cn(
                "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition",
                on ? "border-white bg-white text-[var(--vt-navy)]" : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25 hover:text-white",
              )}
            >
              <span className={cn("size-2 rounded-full", x.dot)} aria-hidden />
              {x.tab}
            </button>
          );
        })}
      </div>

      <div
        id="model-panel"
        role="tabpanel"
        aria-labelledby={`model-tab-${m.key}`}
        className="mt-6 grid gap-6 rounded-3xl border border-white/[0.08] bg-[linear-gradient(160deg,rgba(76,110,245,0.1),rgba(255,255,255,0.015)_60%)] p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-10"
      >
        <div className="flex flex-col">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{m.subtitle}</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">{m.tab}</h3>
          <p className="mt-3 text-[15px] leading-7 text-slate-300">{m.summary}</p>
          <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--vt-coral)]">{m.noteLabel}</p>
            <p className="mt-1.5 text-sm leading-6 text-slate-300">{m.note}</p>
          </div>
        </div>

        {m.factors ? (
          <dl className="grid content-start gap-3 sm:grid-cols-2 sm:[&>*:last-child:nth-child(odd)]:col-span-2">
            {m.factors.map(([label, body]) => (
              <div key={label} className={tile}>
                <dt className="text-sm font-semibold text-white">{label}</dt>
                <dd className="mt-1.5 text-sm leading-6 text-slate-400">{body}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <ul className="grid content-start gap-3">
            {m.statuses?.map((s) => (
              <li key={s.label} className={cn(tile, "flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4")}>
                <span className={cn("w-fit shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider sm:w-28 sm:text-center", s.tone)}>
                  {s.label}
                </span>
                <p className="text-sm leading-6 text-slate-300">{s.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
