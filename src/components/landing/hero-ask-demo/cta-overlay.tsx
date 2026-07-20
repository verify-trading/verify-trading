"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, CheckCircle2, X } from "lucide-react";

import { surface } from "@/components/landing/section-primitives";
import { Button } from "@/components/ui/button";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { PRO_PLAN_FEATURES } from "@/lib/marketing/pro-plan-features";
import { FREE_DAILY_ASK_LIMIT, PRO_DAILY_ASK_LIMIT } from "@/lib/rate-limit/usage";
import { cn } from "@/lib/utils";

// Canonical Free bullets (mirrors pricing-plans.tsx); the daily limit is shown
// as the subline so it isn't repeated here.
const FREE_FEATURES = ["Broker verification", "Trade Analysis", "Risk Calculators"];
// Drop the "X Ask chats per day" item (shown as the subline) from the Pro list.
const PRO_FEATURES = PRO_PLAN_FEATURES.slice(1, 4);

function PlanCard({
  badge,
  badgeClassName,
  title,
  subline,
  features,
  ctaLabel,
  ctaHref,
  ctaVariant,
  onCtaClick,
  highlighted = false,
}: {
  badge: string;
  badgeClassName: string;
  title: string;
  subline: string;
  features: readonly string[];
  ctaLabel: string;
  ctaHref: string;
  ctaVariant: "default" | "outline";
  onCtaClick: () => void;
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        surface,
        "flex flex-col p-3.5",
        highlighted &&
          "border-[var(--vt-coral)]/40 bg-gradient-to-b from-[rgba(242,109,109,0.06)] to-transparent ring-1 ring-[var(--vt-coral)]/25",
      )}
    >
      <span
        className={cn(
          "text-[10px] font-semibold uppercase tracking-wider",
          badgeClassName,
        )}
      >
        {badge}
      </span>
      <h4 className="mt-1.5 text-lg font-bold tracking-tight text-white">{title}</h4>
      <p className="mt-0.5 text-[12px] font-medium text-[var(--vt-blue)]">{subline}</p>
      <ul className="mt-2.5 flex-1 space-y-1.5">
        {features.map((feature) => (
          <li
            key={feature}
            className="flex items-center gap-2 text-[12px] text-slate-200"
          >
            <CheckCircle2
              className="size-3.5 shrink-0 text-[var(--vt-green)]"
              aria-hidden
            />
            {feature}
          </li>
        ))}
      </ul>
      <Button
        asChild
        variant={ctaVariant}
        size="pill"
        className="mt-3.5 w-full justify-center"
      >
        <Link href={ctaHref} prefetch={false} onClick={onCtaClick}>
          {ctaLabel}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </Button>
    </div>
  );
}

/**
 * Subscription CTA, shown as an app-native sheet *inside* the demo screen (the
 * parent must be `relative overflow-hidden`). Mirrors the real pricing cards
 * (surface, green checks, canonical Free/Pro copy + limits) laid out the way
 * pricing looks on mobile — Free + Pro stacked — so it reads as the real app.
 */
export function AskCtaOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const reduced = useReducedMotion();

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="absolute inset-0 z-40 flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-[rgba(5,8,27,0.74)] backdrop-blur-sm"
          />
          <motion.div
            className="ask-scrollbar relative z-10 m-auto max-h-full w-full overflow-y-auto p-3"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 26, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 26, scale: 0.98 }}
            transition={
              reduced ? { duration: 0.2 } : { type: "spring", bounce: 0.24, duration: 0.5 }
            }
          >
            <div className="relative rounded-2xl border border-white/10 bg-[var(--vt-card)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/60 transition hover:bg-white/[0.08] hover:text-white"
              >
                <X className="size-3.5" aria-hidden />
              </button>

              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-coral)]/90">
                Pricing
              </p>
              <h3 className="mt-1.5 text-lg font-bold leading-tight tracking-[-0.02em] text-white">
                Free to start. Pro when you need more.
              </h3>

              <div className="mt-3.5 grid grid-cols-1 gap-2.5">
                <PlanCard
                  badge="Free"
                  badgeClassName="text-slate-500"
                  title="Free"
                  subline={`${FREE_DAILY_ASK_LIMIT} Ask chats a day`}
                  features={FREE_FEATURES}
                  ctaLabel="Create free account"
                  ctaHref="/signup"
                  ctaVariant="outline"
                  onCtaClick={() =>
                    trackAnalyticsEvent(ANALYTICS_EVENTS.createAccountClicked, {
                      location: "hero_demo_overlay",
                    })
                  }
                />
                <PlanCard
                  badge="Most popular"
                  badgeClassName="text-[var(--vt-coral)]"
                  title="Pro"
                  subline={`${PRO_DAILY_ASK_LIMIT} Ask chats a day + premium features`}
                  features={PRO_FEATURES}
                  ctaLabel="See Pro plans"
                  ctaHref="/pricing"
                  ctaVariant="default"
                  onCtaClick={() =>
                    trackAnalyticsEvent(ANALYTICS_EVENTS.proPlanClicked, {
                      location: "hero_demo_overlay",
                      plan: "pricing_page",
                    })
                  }
                  highlighted
                />
              </div>

              <p className="mt-3 text-center text-[11px] text-white/40">
                No card to start · cancel anytime
              </p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
