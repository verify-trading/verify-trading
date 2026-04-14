import { describe, expect, it } from "vitest";

import { buildSparklinePath } from "@/lib/markets/markets-page-data";

describe("buildSparklinePath", () => {
  it("maps varying closes across the vertical band", () => {
    const path = buildSparklinePath([10, 20, 15], 100, 40);
    expect(path).toMatch(/M 0\.00 34\.00/);
    expect(path).toMatch(/L 50\.00 6\.00/);
    expect(path).toMatch(/L 100\.00 20\.00/);
  });

  it("draws a flat line at mid height when all closes are identical", () => {
    const path = buildSparklinePath([1.17, 1.17, 1.17, 1.17], 90, 40);
    expect(path).toMatch(/L 30\.00 20\.00/);
    expect(path).toMatch(/L 60\.00 20\.00/);
    expect(path).toMatch(/L 90\.00 20\.00/);
  });
});
