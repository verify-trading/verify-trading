"use client";

import { Check, FingerprintPattern, Smartphone } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import { JournalIcon } from "@/components/markets/markets-view-tabs";
import { StoreBadges } from "@/components/site/store-badges";

/** What each feature does in the app (copy from the mobile app's own screens). */
const COPY = {
  journal: {
    title: "Journal",
    body: "Your trading day in one place, so you can see what's actually working.",
    points: [
      "Log P&L, mood and the lesson every day",
      "Connect your broker and it fills the days in for you",
      "A weekly insight written from your own sessions",
      "Challenge mode tracks your prop firm target",
    ],
    Icon: JournalIcon,
  },
  mind: {
    title: "Mind",
    body: "Find out what your trading actually costs you, and talk it through.",
    points: [
      "A 30-question assessment of how you trade under pressure",
      "Your discipline radar, scored across five habits",
      "Live voice calls with your AI companion",
      "Every call kept as a transcript you can reread",
    ],
    Icon: FingerprintPattern,
  },
} as const;

/** Same ring for both tabs, with the app's own tab icon inside. */
function StateIcon({ kind }: { kind: keyof typeof COPY }) {
  const Icon = COPY[kind].Icon;
  return (
    <div data-testid={`${kind}-state-icon`} className="relative mb-7 size-24 sm:size-28" aria-hidden>
      <Image src="/logo.svg" alt="" fill sizes="9rem" className="object-contain" />
      <div className="absolute inset-[18%] rounded-full bg-[rgb(10,13,46)] shadow-[0_0_22px_rgba(10,13,46,0.95)]" />
      <div className="absolute inset-0 flex items-center justify-center">
        <Icon className="size-9 text-white sm:size-10" strokeWidth={2} />
      </div>
    </div>
  );
}

/** Journal and Mind live in the mobile app: explain what they do and send people to the stores. */
export function MarketsTabUpcoming({ kind }: { kind: keyof typeof COPY }) {
  const { title, body, points } = COPY[kind];

  return (
    <div className="flex flex-col items-center px-4 py-16 text-center sm:py-20">
      <StateIcon kind={kind} />

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

      <Link href="/pricing" className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--vt-green)] hover:underline">
        Included with Pro
      </Link>
    </div>
  );
}
