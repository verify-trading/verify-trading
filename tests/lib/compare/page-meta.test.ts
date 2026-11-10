import { describe, expect, it } from "vitest";

import { entityDescription } from "@/components/marketing/entity-detail";
import { entityTitle } from "@/lib/compare/page-meta";
import type { PublicEntity } from "@/lib/compare/entities";

const SUFFIX = " | verify.trading";

const broker = (over: Partial<PublicEntity>): PublicEntity =>
  ({ type: "broker", slug: "x", name: "X", verdict: "Verified", score: 88, regulators: [], updatedAt: null, bts: null, ...over }) as PublicEntity;

describe("entityTitle", () => {
  it("uses the descriptive tail while the full title fits in 60 chars", () => {
    expect(entityTitle({ type: "broker", name: "Pepperstone" })).toBe("Is Pepperstone safe? Regulation and verdict");
    expect(entityTitle({ type: "guru", name: "Bob" })).toBe("Is Bob legit? Trader and educator record");
  });

  it("keeps the name and shortens only the tail for long names", () => {
    const name = "Blackwell Global Investments (UK) Limited";
    const title = entityTitle({ type: "broker", name });
    expect(title).toBe(`Is ${name} safe? Verdict`);
    expect(title).toContain(name); // the name is what keeps each page's title unique
    expect(entityTitle({ type: "guru", name })).toBe(`Is ${name} legit? Trader record`);
  });

  it("every title that can fit in 60 chars with the suffix does", () => {
    for (const name of ["IG", "Pepperstone", "A Much Longer Brokerage Name Ltd"]) {
      const full = `${entityTitle({ type: "broker", name })}${SUFFIX}`;
      // Short names must fit; long names may exceed only because the name itself is long.
      if (`Is ${name} safe? Verdict${SUFFIX}`.length <= 60) expect(full.length).toBeLessThanOrEqual(60);
    }
  });
});

describe("entityDescription", () => {
  it("stays within 155 chars and drops whole sentences before cutting", () => {
    const short = entityDescription(broker({ name: "IG", regulators: ["FCA"] }));
    expect(short.length).toBeLessThanOrEqual(155);
    // Tail sentences are dropped whole, so the description always ends at a sentence boundary.
    expect(short.endsWith(".")).toBe(true);
    expect(short).toContain("Listed regulators: FCA.");

    const long = entityDescription(
      broker({
        name: "An Extremely Long Brokerage Company Name International Holdings Limited",
        verdict: "High risk",
        regulators: ["FCA", "CySEC", "ASIC"],
      }),
    );
    expect(long.length).toBeLessThanOrEqual(155);
    expect(long).toContain("An Extremely Long Brokerage Company Name");
  });

  it("covers gurus and prop firms", () => {
    expect(entityDescription(broker({ type: "guru", name: "Some Trader" })).length).toBeLessThanOrEqual(155);
    expect(entityDescription(broker({ type: "propfirm", name: "FTMO" }))).toContain("prop firm check for FTMO");
  });
});
