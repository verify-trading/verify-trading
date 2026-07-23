"use client";

import { useInView } from "framer-motion";
import { useCallback, useRef, useState } from "react";

import type { HeroLiveBriefing } from "./types";
import { useAskDemoSequence } from "./use-ask-demo-sequence";
import { DeviceView } from "./variant-device";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

/**
 * The animated Ask hero demo. Plays a looping question→answer story; any attempt
 * to type or submit in the composer opens the subscription CTA.
 */
export function HeroAskDemo({
  liveBriefing = null,
}: {
  liveBriefing?: HeroLiveBriefing | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Pause the loop while the demo is off-screen (saves work; resumes in place).
  const inView = useInView(containerRef, { amount: 0.25 });
  const [ctaOpen, setCtaOpen] = useState(false);
  const state = useAskDemoSequence({ paused: ctaOpen || !inView, liveBriefing });
  // Stable identities so the memoized message rows aren't invalidated each frame.
  const onActivate = useCallback(() => {
    trackAnalyticsEvent(ANALYTICS_EVENTS.demoClicked, { location: "hero_demo" });
    setCtaOpen(true);
  }, []);
  const onCloseCta = useCallback(() => setCtaOpen(false), []);

  return (
    <div ref={containerRef}>
      <DeviceView
        state={state}
        onActivate={onActivate}
        ctaOpen={ctaOpen}
        onCloseCta={onCloseCta}
      />
    </div>
  );
}
