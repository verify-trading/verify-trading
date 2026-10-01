"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { useState } from "react";

import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { getBillingPlanAmountGbp, type BillingPlanKey } from "@/lib/billing/config";
import { PRO_PLAN_FEATURES } from "@/lib/marketing/pro-plan-features";
import { FREE_DAILY_ASK_LIMIT, PRO_DAILY_ASK_LIMIT } from "@/lib/rate-limit/usage";
import { cn } from "@/lib/utils";

/** What the visitor tapped: an Ask exchange (free) or a Pro screen. `intro` = Ask before any answer. */
export type DemoSheetTarget = "broker" | "briefing" | "calc" | "intro" | "markets" | "calendar" | "journal" | "mind" | "chat";

const FREE_COPY: Record<string, { eyebrow: string; title: string; subline: string }> = {
  broker: {
    eyebrow: "Just like that broker check?",
    title: "Run your own — free.",
    subline: "Every verdict cited to source.",
  },
  briefing: {
    eyebrow: "Like that gold brief?",
    title: "Brief any market — free.",
    subline: "Live levels and the events that move them.",
  },
  calc: {
    eyebrow: "Sized that trade in seconds?",
    title: "Size your own risk — free.",
    subline: "Know your lot size before you click buy.",
  },
  intro: {
    eyebrow: "Ready to verify before you trade?",
    title: "Run your own — free.",
    subline: "Every verdict cited to source.",
  },
};

const FREE_FEATURES = ["Broker Verification", "Trade Analysis", "Risk Calculators"];

type ProFeatureId = "markets" | "mind" | "journal" | "calendar" | "chat";
const PRO_FEATURES: Array<{ id: ProFeatureId; title: string; listLabel: string; description: string }> = [
  {
    id: "markets",
    title: "Live Markets",
    listLabel: PRO_PLAN_FEATURES[1],
    description:
      "Read the daily brief, session tone and market radar for gold and the major pairs before each session opens.",
  },
  {
    id: "mind",
    title: "Psychology AI",
    listLabel: "Psychology AI",
    description:
      "A short assessment, then voice check-ins with an AI companion that spots tilt and revenge-trading patterns before they cost you.",
  },
  {
    id: "journal",
    title: "Trading Journal",
    listLabel: "Trading Journal",
    description:
      "Log every session, track your P&L, win rate and streaks, and get AI coaching on the habits behind your best and worst days.",
  },
  {
    id: "calendar",
    title: "Economic Calendar",
    listLabel: "Economic Calendar",
    description:
      "See every high-impact news event before it moves the market, filtered to the pairs you trade — including the events most prop firm rules restrict.",
  },
  {
    id: "chat",
    title: "Members Chat",
    listLabel: "Members Chat",
    description:
      "A private room for verified traders to discuss setups, brokers, prop firms, and market moves in real-time.",
  },
];
const PRO_EXTRAS = [PRO_PLAN_FEATURES[2], PRO_PLAN_FEATURES[3]];
const PRO_GENERIC = {
  title: "Everything in Pro",
  description: `Live markets, the economic calendar, a trading journal and Psychology AI, plus ${PRO_DAILY_ASK_LIMIT} Ask chats a day.`,
};

const PLANS: Array<{ key: BillingPlanKey; name: string }> = [
  { key: "weekly", name: "Weekly" },
  { key: "monthly", name: "Monthly" },
  { key: "annual", name: "Annual" },
];

const PLAN_DAYS: Record<BillingPlanKey, number> = { weekly: 7, monthly: 30, annual: 365 };
const PLAN_UNIT: Record<BillingPlanKey, string> = { weekly: "week", monthly: "month", annual: "year" };
const gbp = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);

/** Card figures computed from the price constants in billing/config, never parsed from display strings. */
function planFigures(key: BillingPlanKey) {
  const price = getBillingPlanAmountGbp(key);
  const rawPence = (price / PLAN_DAYS[key]) * 100;
  // Same rounding as the pricing section: annual rounds, the rest floor.
  const pence = key === "annual" ? Math.round(rawPence) : Math.floor(rawPence + 1e-9);
  const savings = getBillingPlanAmountGbp("monthly") * 12 - price;
  return {
    amount: gbp(price),
    per: `/${PLAN_UNIT[key]}`,
    daily: `${pence >= 100 ? gbp(pence / 100) : `${pence}p`}/day`,
    savings: key === "annual" ? `Save ${gbp(savings)}` : undefined,
  };
}

const eyebrow = "text-[10px] font-bold uppercase tracking-[0.18em]";

function CheckList({ items, tone }: { items: readonly string[]; tone: "green" | "purple" }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-center gap-2.5 text-[13px] text-slate-100">
          <span
            className={cn(
              "flex size-[18px] shrink-0 items-center justify-center rounded-full text-white",
              tone === "green" ? "bg-[var(--vt-green)]" : "bg-purple-500",
            )}
          >
            <Check className="size-3" strokeWidth={3.5} aria-hidden />
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

function FreeSheet({
  copy,
  onExplorePro,
}: {
  copy: (typeof FREE_COPY)[string];
  onExplorePro: () => void;
}) {
  return (
    <>
      <p className={cn(eyebrow, "text-[var(--vt-coral)]")}>{copy.eyebrow}</p>
      <h3 className="mt-2 text-[28px] font-extrabold leading-[1.05] tracking-[-0.03em] text-white">
        {copy.title}
      </h3>
      <p className="mt-2 text-[13px] text-[var(--vt-muted)]">{copy.subline}</p>

      <div className="mt-4 rounded-2xl border border-[var(--vt-green)]/60 bg-[var(--vt-green)]/[0.05] p-4 shadow-[0_0_28px_rgba(34,197,94,0.22)]">
        <p className={cn(eyebrow, "text-[var(--vt-green)]")}>Free plan</p>
        <p className="mt-0.5 text-[12px] text-[var(--vt-muted)]">
          {FREE_DAILY_ASK_LIMIT} checks a day — no card required
        </p>
        <div className="mt-3.5">
          <CheckList items={FREE_FEATURES} tone="green" />
        </div>
      </div>

      <Link
        href="/signup"
        prefetch={false}
        onClick={() =>
          trackAnalyticsEvent(ANALYTICS_EVENTS.createAccountClicked, { location: "hero_demo_sheet" })
        }
        className="mt-4 flex h-12 w-full cursor-pointer items-center justify-center rounded-full bg-gradient-to-r from-[var(--vt-coral)] to-[#f472b6] text-[14px] font-bold text-white shadow-[0_10px_24px_-8px_rgba(242,109,109,0.6)] transition hover:brightness-105"
      >
        Create free account →
      </Link>
      <button
        type="button"
        onClick={onExplorePro}
        className="mt-3.5 block w-full cursor-pointer text-center text-[13px] font-semibold text-[var(--vt-coral)] hover:underline"
      >
        Explore Pro features →
      </button>
      <p className="mt-3 text-center text-[11px] text-white/40">No card to start · cancel anytime</p>
    </>
  );
}

function ProSheet({
  featureId,
  onBack,
}: {
  featureId: ProFeatureId | null;
  onBack: () => void;
}) {
  const [plan, setPlan] = useState<BillingPlanKey>("monthly");
  const feature = PRO_FEATURES.find((f) => f.id === featureId);
  const title = feature?.title ?? PRO_GENERIC.title;
  const included = [
    ...PRO_FEATURES.filter((f) => f.id !== featureId).map((f) => f.listLabel),
    ...PRO_EXTRAS,
  ];
  const planName = PLANS.find((p) => p.key === plan)!.name;

  return (
    <>
      <p className={cn(eyebrow, "text-purple-400")}>{feature ? "Pro feature" : "Pro"}</p>
      <h3 className="mt-2 text-[26px] font-extrabold leading-[1.05] tracking-[-0.03em] text-white">
        {title}
      </h3>
      <p className="mt-2 text-[12.5px] leading-[1.5] text-[var(--vt-muted)]">
        {feature?.description ?? PRO_GENERIC.description}
      </p>

      <div className="my-4 h-px bg-white/10" />
      <p className={cn(eyebrow, "mb-2.5 text-[var(--vt-muted)]")}>
        {feature ? "Also included in Pro" : "Included in Pro"}
      </p>
      <CheckList items={included} tone="purple" />

      <div role="radiogroup" aria-label="Plan" className="mt-5 grid grid-cols-3 gap-2 pt-2">
        {PLANS.map(({ key, name }) => {
          const f = planFigures(key);
          const selected = plan === key;
          const badge = key === "monthly" ? "Popular" : f.savings;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPlan(key)}
              className={cn(
                "relative cursor-pointer rounded-2xl p-px text-left transition",
                selected && key === "monthly"
                  ? "bg-gradient-to-br from-purple-500 to-[var(--vt-coral)]"
                  : selected
                    ? "bg-purple-500"
                    : "bg-white/12",
              )}
            >
              {badge ? (
                <span className="absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--vt-coral)] px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
                  {badge}
                </span>
              ) : null}
              <span className="flex h-full flex-col items-start rounded-[15px] bg-[var(--vt-card)] px-2 pb-2.5 pt-3.5">
                <span className="text-[11px] font-semibold text-white">{name}</span>
                <span className="mt-1 text-[17px] font-bold leading-none tracking-tight text-white">
                  {f.amount}
                </span>
                <span className="text-[9px] text-[var(--vt-muted)]">{f.per}</span>
                <span className="mt-1 text-[9px] font-medium text-purple-300">{f.daily}</span>
                <span
                  className={cn(
                    "mt-2 flex size-4 items-center justify-center rounded-full border-2",
                    selected ? "border-purple-400" : "border-white/25",
                  )}
                >
                  {selected ? <span className="size-1.5 rounded-full bg-purple-400" /> : null}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <Link
        href={`/signup?next=${encodeURIComponent(`/billing?plan=${plan}`)}`}
        prefetch={false}
        onClick={() =>
          trackAnalyticsEvent(ANALYTICS_EVENTS.proPlanClicked, { location: "hero_demo_sheet", plan })
        }
        className="mt-4 flex h-12 w-full cursor-pointer items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-[var(--vt-coral)] text-[14px] font-bold text-white shadow-[0_10px_24px_-8px_rgba(168,85,247,0.6)] transition hover:brightness-105"
      >
        Continue with {planName} →
      </Link>
      <button
        type="button"
        onClick={onBack}
        className="mt-3.5 block w-full cursor-pointer text-center text-[13px] font-semibold text-[var(--vt-muted)] hover:text-white"
      >
        ← Back to free features
      </button>
      <p className="mt-3 text-center text-[11px] text-white/40">No commitment — cancel anytime</p>
    </>
  );
}

/**
 * Bottom sheet rendered *inside* the phone screen (the parent must be
 * `relative overflow-hidden`). Free (Ask taps) and Pro (Pro-screen taps) variants
 * swap in place via the two link buttons.
 */
export function DemoSheet({
  target,
  onClose,
}: {
  target: DemoSheetTarget | null;
  onClose: () => void;
}) {
  const reduced = useReducedMotion();
  // Which side is showing; null follows the tapped screen. Reset by remounting on each open (key).
  const [override, setOverride] = useState<"free" | "pro" | null>(null);
  const isAsk = target === "broker" || target === "briefing" || target === "calc" || target === "intro";
  const mode = override ?? (isAsk ? "free" : "pro");

  return (
    <AnimatePresence onExitComplete={() => setOverride(null)}>
      {target ? (
        <motion.div
          className="absolute inset-0 z-40 flex items-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 cursor-pointer bg-[rgba(5,8,27,0.7)] backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={mode === "free" ? "Create a free account" : "Verify.trading Pro"}
            className="ask-scrollbar relative z-10 max-h-[92%] w-full overflow-y-auto rounded-t-[28px] border-t border-white/10 bg-[var(--vt-card)] px-5 pb-6 pt-2.5 shadow-[0_-20px_60px_rgba(0,0,0,0.5)]"
            initial={reduced ? { opacity: 0 } : { y: "100%" }}
            animate={reduced ? { opacity: 1 } : { y: 0 }}
            exit={reduced ? { opacity: 0 } : { y: "100%" }}
            transition={reduced ? { duration: 0.2 } : { type: "spring", bounce: 0.12, duration: 0.5 }}
          >
            <div className="mx-auto h-1 w-10 rounded-full bg-white/25" aria-hidden />
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="absolute right-4 top-4 flex size-7 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/15 hover:text-white"
            >
              <X className="size-3.5" aria-hidden />
            </button>
            <div className="pt-4">
              {mode === "free" ? (
                <FreeSheet
                  copy={FREE_COPY[isAsk ? target : "intro"]}
                  onExplorePro={() => setOverride("pro")}
                />
              ) : (
                <ProSheet
                  featureId={isAsk ? null : PRO_FEATURES.find((f) => f.id === target)?.id ?? null}
                  onBack={() => setOverride("free")}
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
