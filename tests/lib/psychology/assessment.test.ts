import { describe, expect, it } from "vitest";

import { scorePsychologyAssessment } from "@/lib/psychology/assessment";

describe("scorePsychologyAssessment", () => {
  it("derives total score, focus area, and zone", () => {
    expect(
      scorePsychologyAssessment({
        wrong: 6,
        fear: 9,
        compulsion: 12,
        awareness: 8,
        discipline: 7,
      }),
    ).toEqual(expect.objectContaining({
      totalScore: 42,
      maxScore: 75,
      focusArea: "compulsion",
      zoneLabel: "Reactive Trader",
    }));
  });
});
