"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button-variants";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS, type AnalyticsEventName } from "@/lib/analytics/events";
import { cn } from "@/lib/utils";

export type CtaEvent = "ask" | "signup" | "pricing" | "guide";

const EVENT_BY_CTA: Record<CtaEvent, AnalyticsEventName> = {
  ask: ANALYTICS_EVENTS.openAskClicked,
  signup: ANALYTICS_EVENTS.createAccountClicked,
  pricing: ANALYTICS_EVENTS.proPlanClicked,
  guide: ANALYTICS_EVENTS.guideClicked,
};

/** Link styled as a Button that reports the click to analytics. */
export function CtaLink({
  href,
  event,
  location,
  variant = "default",
  className,
  children,
}: {
  href: string;
  event?: CtaEvent;
  location: string;
  variant?: "default" | "outline";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      onClick={event ? () => trackAnalyticsEvent(EVENT_BY_CTA[event], { location }) : undefined}
      className={cn(buttonVariants({ variant, size: "pill" }), "px-7", className)}
    >
      {children}
    </Link>
  );
}
