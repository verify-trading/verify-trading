"use client";

import { BookOpen, Brain, Sparkles } from "lucide-react";

const COPY = {
  journal: {
    title: "Trading Journal",
    body: "Coming soon. Every trade you verify will be automatically saved here. Your full decision history, ITVE scores and outcomes in one place.",
    Icon: BookOpen,
  },
  mind: {
    title: "Psychological AI",
    body: "Coming soon. Emotional state checks, post-loss management and session readiness scoring — all before you enter a single trade.",
    Icon: Brain,
  },
} as const;

export function MarketsTabUpcoming({ kind }: { kind: keyof typeof COPY }) {
  const { title, body, Icon } = COPY[kind];

  return (
    <div className="flex flex-col items-center px-4 py-20 text-center">
      <div className="mb-5 inline-flex size-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-[var(--vt-coral)]">
        <Icon className="size-5" aria-hidden />
      </div>

      <h2 className="text-xl font-bold tracking-tight text-white">{title}</h2>

      <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[rgba(76,110,245,0.3)] bg-[rgba(76,110,245,0.08)] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--vt-blue)]">
        <Sparkles className="size-3" aria-hidden />
        Coming soon
      </span>

      <p className="mt-5 max-w-sm text-sm leading-relaxed text-[var(--vt-muted)]">{body}</p>

      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--vt-green)]">
        Pro members get access first.
      </p>
    </div>
  );
}
