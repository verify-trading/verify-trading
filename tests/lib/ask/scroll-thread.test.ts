import { describe, expect, it } from "vitest";

import {
  ASK_PINNED_THRESHOLD_PX,
  getDistanceFromBottom,
  isPinnedNearBottom,
} from "@/lib/ask/scroll-thread";

function scrollLike(
  scrollHeight: number,
  clientHeight: number,
  scrollTop: number,
): HTMLElement {
  return {
    scrollHeight,
    clientHeight,
    scrollTop,
  } as HTMLElement;
}

describe("scroll-thread", () => {
  it("getDistanceFromBottom is zero at the bottom edge", () => {
    const el = scrollLike(1000, 400, 600);
    expect(getDistanceFromBottom(el)).toBe(0);
  });

  it("getDistanceFromBottom grows when scrolled away from bottom", () => {
    const el = scrollLike(1000, 400, 0);
    expect(getDistanceFromBottom(el)).toBe(600);
  });

  it("isPinnedNearBottom matches the default threshold", () => {
    const el = scrollLike(1000, 400, 505);
    expect(getDistanceFromBottom(el)).toBe(95);
    expect(isPinnedNearBottom(el)).toBe(true);
  });

  it("isPinnedNearBottom is false when farther than threshold", () => {
    const el = scrollLike(1000, 400, 0);
    expect(isPinnedNearBottom(el)).toBe(false);
  });

  it("exports a sensible default threshold", () => {
    expect(ASK_PINNED_THRESHOLD_PX).toBe(96);
  });
});
