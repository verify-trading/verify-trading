"use client";

import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DEMO_EXCHANGES,
  DEMO_SCREENS,
  DEMO_SUGGESTIONS,
  PRO_SCREEN_HOLD_MS,
  type DemoExchange,
  type DemoScreen,
  type HeroLiveBriefing,
} from "./types";

/**
 * The full presentation state at a single moment of the loop. Variants render
 * this however they like — the state itself is presentation-agnostic.
 */
export type DemoState = {
  /** Which app screen the phone is on. Ask replays the exchanges; the rest are timed Pro screens. */
  screen: DemoScreen;
  /** Answered exchanges currently sitting in the thread. */
  thread: DemoExchange[];
  /** The question shown as a user bubble that is still awaiting its answer. */
  pendingQuestion: string | null;
  /** Assistant "thinking" indicator is visible. */
  thinking: boolean;
  /** Current "thinking" status phrase (cycles to read as real work). */
  thinkingLabel: string;
  /** Intro/empty state (logo ring + suggestion chips) is visible. */
  showIntro: boolean;
  /** Index of the suggestion chip being "pressed", or -1. */
  activeSuggestion: number;
};

export type Frame = { state: DemoState; ms: number };

const DEFAULT_THINKING = "Thinking through your question";

const EMPTY: DemoState = {
  screen: "ask",
  thread: [],
  pendingQuestion: null,
  thinking: false,
  thinkingLabel: DEFAULT_THINKING,
  showIntro: true,
  activeSuggestion: -1,
};

// Per-beat durations (ms). Tuned to feel like a real, unhurried conversation —
// the question appears, it works through it, you read the answer.
const TIMING = {
  introHold: 1400,
  chipPress: 500,
  composeBeat: 380,
  sendHold: 450,
  thinkStep: 680,
  answerHold: 3400,
  loopReset: 1500,
} as const;

/** Merge real gold values over the scripted briefing card when available. */
export function resolveExchanges(liveBriefing: HeroLiveBriefing | null): DemoExchange[] {
  if (!liveBriefing) return DEMO_EXCHANGES;
  return DEMO_EXCHANGES.map((exchange) =>
    exchange.card.type === "briefing"
      ? { ...exchange, card: { ...exchange.card, ...liveBriefing } }
      : exchange,
  );
}

/** Pre-computed frames make pause/resume trivial (stop advancing the index) and the loop deterministic. */
export function buildFrames(exchanges: DemoExchange[]): Frame[] {
  const frames: Frame[] = [];
  const push = (patch: Partial<DemoState>, ms: number, base: DemoState) =>
    frames.push({ state: { ...base, ...patch }, ms });

  // Intro / empty state.
  push({}, TIMING.introHold, EMPTY);

  // One complete question→answer is on screen at a time. While the previous
  // answer is up you read it; then it animates out as the new question bubble
  // animates in. This keeps every card fully visible (no ever-growing scroll).
  let prev: DemoExchange | null = null;

  exchanges.forEach((exchange, exchangeIndex) => {
    const onIntro = exchangeIndex === 0;
    const chipIndex = DEMO_SUGGESTIONS.indexOf(exchange.question);
    const carried: DemoState = {
      ...EMPTY,
      thread: prev ? [prev] : [],
      showIntro: onIntro,
    };

    // Press the matching suggestion chip (first turn starts from the intro),
    // otherwise just hold a beat on the previous answer before the follow-up.
    if (onIntro && chipIndex >= 0) {
      push({ activeSuggestion: chipIndex }, TIMING.chipPress, carried);
    } else {
      push({}, TIMING.composeBeat, carried);
    }

    // The question appears as a user bubble (the previous exchange clears).
    push({ pendingQuestion: exchange.question }, TIMING.sendHold, EMPTY);

    // Thinking… cycle through the exchange's status phrases (reads as real work).
    exchange.thinkingSteps.forEach((label) => {
      push(
        {
          pendingQuestion: exchange.question,
          thinking: true,
          thinkingLabel: label,
        },
        TIMING.thinkStep,
        EMPTY,
      );
    });

    // Answer revealed.
    push({ thread: [exchange] }, TIMING.answerHold, EMPTY);

    prev = exchange;
  });

  // Hold the last answer briefly, then leave Ask for the Pro screens.
  push(
    {},
    TIMING.loopReset,
    { ...EMPTY, thread: prev ? [prev] : [], showIntro: false },
  );

  // Every non-Ask screen in the cycle gets its own timed frame, so none can be skipped:
  // Markets (Intelligence), then the same Markets screen on its Economic sub-tab, Journal, Mind.
  for (const screen of DEMO_SCREENS) {
    if (screen !== "ask") push({ screen, showIntro: false }, PRO_SCREEN_HOLD_MS, EMPTY);
  }

  return frames;
}

/**
 * Drives the whole phone demo: the Ask exchanges, then each Pro screen, then back to the start.
 * Pass `paused` (sheet open, pointer down, off-screen) to freeze it in place. `liveBriefing`
 * overrides the scripted gold card with real, server-fetched values. `goTo` jumps to a screen
 * (a tab tap) and works under reduced motion, where nothing advances on its own.
 */
export function useAskDemoSequence({
  paused = false,
  liveBriefing = null,
}: {
  paused?: boolean;
  liveBriefing?: HeroLiveBriefing | null;
} = {}): { state: DemoState; goTo: (screen: DemoScreen) => void } {
  const exchanges = useMemo(() => resolveExchanges(liveBriefing), [liveBriefing]);
  const frames = useMemo(() => buildFrames(exchanges), [exchanges]);
  const reduced = useReducedMotion() ?? false;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduced || paused) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % frames.length), frames[index].ms);
    return () => clearTimeout(timer);
  }, [index, paused, reduced, frames]);

  const goTo = useCallback(
    (screen: DemoScreen) => setIndex(Math.max(0, frames.findIndex((f) => f.state.screen === screen))),
    [frames],
  );

  const current = frames[index].state;
  // Representative still frame for visitors who prefer reduced motion (Pro screens stay reachable by tab).
  const state =
    reduced && current.screen === "ask" ? { ...EMPTY, thread: [exchanges[0]], showIntro: false } : current;
  return { state, goTo };
}
