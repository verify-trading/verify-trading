import { describe, expect, it } from "vitest";

import {
  DEMO_EXCHANGES,
  DEMO_SCREENS,
  PRO_SCREEN_HOLD_MS,
} from "@/components/landing/hero-ask-demo/types";
import { buildFrames } from "@/components/landing/hero-ask-demo/use-ask-demo-sequence";

describe("hero demo timeline", () => {
  const frames = buildFrames(DEMO_EXCHANGES);

  it("shows every screen in the cycle, including the economic calendar, with a positive hold", () => {
    expect(DEMO_SCREENS).toContain("calendar");
    for (const screen of DEMO_SCREENS) {
      const held = frames.filter((f) => f.state.screen === screen).reduce((sum, f) => sum + f.ms, 0);
      expect(held, screen).toBeGreaterThan(0);
    }
  });

  it("holds each Pro screen for the full hold time and visits them in cycle order", () => {
    const pro = frames.filter((f) => f.state.screen !== "ask");
    expect(pro.map((f) => f.state.screen)).toEqual(DEMO_SCREENS.filter((s) => s !== "ask"));
    for (const f of pro) expect(f.ms).toBe(PRO_SCREEN_HOLD_MS);
  });
});
