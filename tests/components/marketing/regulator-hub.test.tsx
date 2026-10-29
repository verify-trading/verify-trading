// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RegulatorHub } from "@/components/marketing/regulator-views";
import { getRegulator } from "@/lib/compare/regulators";

afterEach(cleanup);

describe("RegulatorHub layout", () => {
  it("puts the article in the wide first grid column and the TOC rail second", () => {
    const regulator = getRegulator("sca-uae")!;
    const { container } = render(<RegulatorHub hub={{ regulator, entities: [], verdicts: {} }} uniqueCode others={[]} />);
    const grid = container.querySelector(".lg\\:grid-cols-\\[minmax\\(0\\,1fr\\)_14rem\\]")!;
    const [first, second] = Array.from(grid.children);
    expect(first.querySelector("#about")).not.toBeNull();
    expect(second.tagName).toBe("ASIDE");
    expect(screen.getByRole("navigation", { name: "On this page" }).closest("aside")).toBe(second);
  });
});
