"use client";

import { Calendar, Newspaper, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

const COPY = {
  intelligence: {
    eyebrow: "News & flow",
    title: "Market intelligence",
    body: "Headlines, sentiment, and flow context for these markets.",
    Icon: Newspaper,
  },
  calendar: {
    eyebrow: "Macro",
    title: "Economic calendar",
    body: "Scheduled releases, consensus, and impact labels.",
    Icon: Calendar,
  },
} as const;

export function MarketsTabUpcoming({ kind }: { kind: keyof typeof COPY }) {
  const { eyebrow, title, body, Icon } = COPY[kind];

  return (
    <div className="min-w-0">
      <div
        className={cn(
          "overflow-hidden rounded-[28px] border border-[color:var(--vt-border)]",
          "bg-gradient-to-b from-[var(--vt-card)] to-[rgba(15,19,64,0.6)]",
          "shadow-[0_24px_60px_rgba(10,13,46,0.32)]",
        )}
      >
        <div className="border-b border-white/[0.06] px-5 py-4 sm:px-6">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--vt-muted)]">
            <span className="inline-flex size-8 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-[var(--vt-coral)]">
              <Icon className="size-4" aria-hidden />
            </span>
            {eyebrow}
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">{title}</h2>
        </div>

        <div className="flex flex-col items-center gap-4 px-5 py-14 text-center sm:px-8 sm:py-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(76,110,245,0.35)] bg-[rgba(76,110,245,0.12)] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--vt-blue)]">
            <Sparkles className="size-3.5" aria-hidden />
            Coming soon
          </span>
          <p className="max-w-md text-sm leading-relaxed text-[var(--vt-muted)]">{body}</p>
        </div>
      </div>
    </div>
  );
}
