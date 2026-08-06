import { beforeEach, describe, expect, it, vi } from "vitest";

import { claimTtsChars, TTS_MAX_CHARS } from "@/lib/psychology/tts";

// The counter is module state keyed by user, so each case uses its own id rather than resetting it.
describe("claimTtsChars", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("allows a normal day of coaching and refuses a runaway loop", () => {
    const user = "user-normal";
    // 60k budget / 800 chars is 75 full-length replies — far past any real session.
    for (let i = 0; i < 75; i += 1) {
      expect(claimTtsChars(user, TTS_MAX_CHARS)).toBe(true);
    }
    expect(claimTtsChars(user, TTS_MAX_CHARS)).toBe(false);
  });

  it("charges before synthesis, so a refused request does not consume more budget", () => {
    const user = "user-refused";
    expect(claimTtsChars(user, 59_000)).toBe(true);
    // Over the remaining 1,000 — refused, and must not bank the attempt.
    expect(claimTtsChars(user, 5_000)).toBe(false);
    expect(claimTtsChars(user, 900)).toBe(true);
  });

  it("resets on the next UTC day", () => {
    const user = "user-rollover";
    expect(claimTtsChars(user, 60_000)).toBe(true);
    expect(claimTtsChars(user, 1)).toBe(false);

    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 86_400_000));
    expect(claimTtsChars(user, TTS_MAX_CHARS)).toBe(true);
  });

  it("meters each trader separately", () => {
    expect(claimTtsChars("user-a", 60_000)).toBe(true);
    expect(claimTtsChars("user-a", 1)).toBe(false);
    expect(claimTtsChars("user-b", TTS_MAX_CHARS)).toBe(true);
  });
});
