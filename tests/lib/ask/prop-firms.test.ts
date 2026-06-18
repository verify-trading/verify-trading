import { describe, expect, it } from "vitest";

import { computePropFirmScore } from "@/lib/ask/prop-firms";

describe("computePropFirmScore", () => {
  it("uses the auto baseline and bands it", () => {
    const result = computePropFirmScore({ firmStatus: null, autoScore: 6.3, founderOverrideScore: null });
    expect(result.score).toBe(6.3);
    expect(result.band).toBe("Proceed With Caution");
    expect(result.notRated).toBe(false);
  });

  it("hard-overrides a closed firm to Avoid", () => {
    const result = computePropFirmScore({
      firmStatus: "Closed down - wound down 2026",
      autoScore: 7.5,
      founderOverrideScore: null,
    });
    expect(result.score).toBe(1.0);
    expect(result.band).toBe("Avoid");
    expect(result.closed).toBe(true);
  });

  it("lets the founder override beat the formula", () => {
    const result = computePropFirmScore({ firmStatus: null, autoScore: 4.0, founderOverrideScore: 8.7 });
    expect(result.score).toBe(8.7);
    expect(result.band).toBe("Strongly Trusted");
  });

  it("returns Not yet rated when there is no score and no override", () => {
    const result = computePropFirmScore({ firmStatus: null, autoScore: null, founderOverrideScore: null });
    expect(result.score).toBeNull();
    expect(result.band).toBeNull();
    expect(result.notRated).toBe(true);
  });

  it("maps each band boundary", () => {
    expect(computePropFirmScore({ firmStatus: null, autoScore: 8.5, founderOverrideScore: null }).band).toBe(
      "Strongly Trusted",
    );
    expect(computePropFirmScore({ firmStatus: null, autoScore: 7.0, founderOverrideScore: null }).band).toBe(
      "Trusted",
    );
    expect(computePropFirmScore({ firmStatus: null, autoScore: 4.0, founderOverrideScore: null }).band).toBe(
      "High Risk",
    );
    expect(computePropFirmScore({ firmStatus: null, autoScore: 2.0, founderOverrideScore: null }).band).toBe(
      "Avoid",
    );
  });
});
