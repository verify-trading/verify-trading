"use client";

import { useInView } from "framer-motion";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { useCallback, useRef, useState } from "react";

import type { VariantViewProps } from "./shared";
import type { HeroAskVariant, HeroLiveBriefing } from "./types";
import { useAskDemoSequence } from "./use-ask-demo-sequence";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

// Only the *type* crosses the client barrel; the HERO_ASK_VARIANTS value lives in
// the server-safe ./types so Server Components can read it without this boundary.
export type { HeroAskVariant } from "./types";

// Lazy-load each variant so the homepage (which only ever renders "device")
// doesn't ship the other three designs in its JS bundle. SSR stays enabled so
// there's no hydration layout shift — this is chunk-splitting, not client-only.
const VIEWS: Record<HeroAskVariant, ComponentType<VariantViewProps>> = {
  device: dynamic(() => import("./variant-device").then((m) => m.DeviceView)),
  glass: dynamic(() => import("./variant-glass").then((m) => m.GlassView)),
  island: dynamic(() => import("./variant-island").then((m) => m.IslandView)),
  editorial: dynamic(() => import("./variant-editorial").then((m) => m.EditorialView)),
};

/**
 * The animated Ask hero demo. Plays a looping question→answer story; any attempt
 * to type or submit in the composer opens the subscription CTA.
 */
export function HeroAskDemo({
  variant = "device",
  liveBriefing = null,
}: {
  variant?: HeroAskVariant;
  liveBriefing?: HeroLiveBriefing | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Pause the loop while the demo is off-screen (saves work; resumes in place).
  const inView = useInView(containerRef, { amount: 0.25 });
  const [ctaOpen, setCtaOpen] = useState(false);
  const state = useAskDemoSequence({ paused: ctaOpen || !inView, liveBriefing });
  // Stable identities so the memoized message rows aren't invalidated each frame.
  const onActivate = useCallback(() => {
    trackAnalyticsEvent(ANALYTICS_EVENTS.demoClicked, {
      location: "hero_demo",
      variant,
    });
    setCtaOpen(true);
  }, [variant]);
  const onCloseCta = useCallback(() => setCtaOpen(false), []);
  const View = VIEWS[variant];

  return (
    <div ref={containerRef}>
      <View
        state={state}
        onActivate={onActivate}
        ctaOpen={ctaOpen}
        onCloseCta={onCloseCta}
      />
    </div>
  );
}
