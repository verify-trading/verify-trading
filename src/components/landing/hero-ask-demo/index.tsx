"use client";

import { useInView } from "framer-motion";
import { useCallback, useRef, useState } from "react";

import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

import type { DemoSheetTarget } from "./demo-sheet";
import { DEMO_EXCHANGES, type HeroLiveBriefing } from "./types";
import { useAskDemoSequence } from "./use-ask-demo-sequence";
import { DeviceView } from "./variant-device";

/**
 * The animated hero demo. One timeline (use-ask-demo-sequence) cycles Ask → Markets → Economic calendar → Journal → Mind;
 * tapping the demo opens the free or Pro sheet that matches the screen showing.
 * The cycle pauses while the sheet is open, a pointer is down, or it is off-screen.
 */
export function HeroAskDemo({
  liveBriefing = null,
}: {
  liveBriefing?: HeroLiveBriefing | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { amount: 0.25 });
  const [sheetTarget, setSheetTarget] = useState<DemoSheetTarget | null>(null);
  const [holding, setHolding] = useState(false);

  const paused = sheetTarget !== null || holding || !inView;
  const { state, goTo } = useAskDemoSequence({ paused, liveBriefing });
  const screen = state.screen;

  // What is showing right now decides which sheet a tap opens.
  const target: DemoSheetTarget =
    screen !== "ask"
      ? screen
      : ((state.thread[0] ?? DEMO_EXCHANGES.find((e) => e.question === state.pendingQuestion))?.id as
          | "broker"
          | "briefing"
          | "calc"
          | undefined) ?? "intro";

  const onActivate = useCallback(() => {
    trackAnalyticsEvent(ANALYTICS_EVENTS.demoClicked, { location: "hero_demo", screen: target });
    setSheetTarget(target);
  }, [target]);
  const onCloseSheet = useCallback(() => setSheetTarget(null), []);

  return (
    <div ref={containerRef}>
      <DeviceView
        screen={screen}
        state={state}
        onActivate={onActivate}
        onSelectScreen={goTo}
        onHold={setHolding}
        sheetTarget={sheetTarget}
        onCloseSheet={onCloseSheet}
      />
    </div>
  );
}
