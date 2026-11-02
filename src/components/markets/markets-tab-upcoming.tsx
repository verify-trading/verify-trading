"use client";

import { BookOpen, Brain, Check, Smartphone, type LucideIcon } from "lucide-react";
import Image from "next/image";

import { StoreBadges } from "@/components/site/store-badges";

/** What each feature does in the app (copy from the mobile app's own screens). */
const COPY = {
  journal: {
    title: "Trading Journal",
    body: "Your trading day in one place, so you can see what's actually working.",
    points: [
      "Log P&L, mood and the lesson every day",
      "Connect your broker and it fills the days in for you",
      "A weekly insight written from your own sessions",
      "Challenge mode tracks your prop firm target",
    ],
    Icon: BookOpen,
  },
  mind: {
    title: "Psychological AI",
    body: "Find out what your trading actually costs you, and talk it through.",
    points: [
      "A 30-question assessment of how you trade under pressure",
      "Your discipline radar, scored across five habits",
      "Live voice calls with your AI companion",
      "Every call kept as a transcript you can reread",
    ],
    Icon: Brain,
  },
} as const;

function JournalStateIcon({ Icon }: { Icon: LucideIcon }) {
  return (
    <div
      data-testid="journal-state-icon"
      className="relative mb-7 size-24 sm:size-28"
      aria-hidden
    >
      <Image
        src="/logo.svg"
        alt=""
        fill
        sizes="9rem"
        className="object-contain"
      />
      <div className="absolute inset-[18%] rounded-full bg-[rgb(10,13,46)] shadow-[0_0_22px_rgba(10,13,46,0.95)]" />
      <div className="absolute inset-0 flex items-center justify-center">
        <Icon className="size-9 text-white sm:size-10" strokeWidth={2.7} />
      </div>
    </div>
  );
}

function MindStateIcon() {
  return (
    <div
      data-testid="mind-state-orb"
      className="relative mb-7 flex size-36 items-center justify-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_30%_80%,#1538ff_0%,transparent_48%),radial-gradient(circle_at_80%_20%,#ff5566_0%,transparent_42%),linear-gradient(135deg,#1530ff,#7a35ff_48%,#ff5566)] shadow-[0_0_42px_rgba(122,53,255,0.42)] sm:size-40"
      aria-hidden
    >
      <div className="absolute inset-[2px] rounded-full border border-white/20" />
      <div className="absolute h-[34%] w-[135%] -rotate-12 rounded-full bg-[#ff7ddf]/25 blur-md" />
      <div className="absolute h-[28%] w-[130%] rotate-[-28deg] rounded-full bg-[#0c1d9c]/35 blur-lg" />
      <div className="absolute inset-[18%] rounded-full bg-[rgb(10,13,46)]/20" />
      <Brain className="relative size-10 text-white drop-shadow-[0_2px_12px_rgba(255,255,255,0.28)]" strokeWidth={2.4} />
    </div>
  );
}

/** Journal and Mind live in the mobile app: explain what they do and send people to the stores. */
export function MarketsTabUpcoming({ kind }: { kind: keyof typeof COPY }) {
  const { title, body, points, Icon } = COPY[kind];

  return (
    <div className="flex flex-col items-center px-4 py-16 text-center sm:py-20">
      {kind === "journal" ? <JournalStateIcon Icon={Icon} /> : <MindStateIcon />}

      <h2 className="text-xl font-bold tracking-tight text-white">{title}</h2>

      <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[rgba(76,110,245,0.3)] bg-[rgba(76,110,245,0.08)] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--vt-blue)]">
        <Smartphone className="size-3" aria-hidden />
        In the verify.trading app
      </span>

      <p className="mt-5 max-w-sm text-sm leading-relaxed text-[var(--vt-muted)]">{body}</p>

      <ul className="mt-5 w-full max-w-sm space-y-2.5 text-left">
        {points.map((p) => (
          <li key={p} className="flex gap-2.5 text-sm leading-snug text-slate-200">
            <Check className="mt-0.5 size-4 shrink-0 text-[var(--vt-green)]" aria-hidden />
            {p}
          </li>
        ))}
      </ul>

      <div className="mt-7">
        <StoreBadges location={`markets_${kind}_tab`} />
      </div>

      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--vt-green)]">Included with Pro</p>
    </div>
  );
}
