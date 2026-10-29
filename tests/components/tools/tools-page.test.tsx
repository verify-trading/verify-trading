// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ToolsPage } from "@/components/tools/tools-page";

afterEach(cleanup);

describe("ToolsPage layout", () => {
  it("owns its own scroll, since the app shell clips overflow", () => {
    const { container } = render(<ToolsPage />);
    expect(container.firstElementChild?.className).toContain("overflow-y-auto");
  });

  it("keeps every calculator mounted in one grid cell and only exposes the active one", () => {
    const { container } = render(<ToolsPage />);
    const panes = Array.from(container.querySelectorAll<HTMLElement>("[data-calculator]"));
    expect(panes.map((p) => p.dataset.calculator)).toEqual([
      "lot-size", "risk-reward", "pip-value", "margin", "profit-loss", "compound",
    ]);
    const visible = () => panes.filter((p) => p.getAttribute("aria-hidden") !== "true").map((p) => p.dataset.calculator);
    expect(visible()).toEqual(["lot-size"]);

    fireEvent.click(screen.getByRole("button", { name: "Pip Value" }));
    expect(visible()).toEqual(["pip-value"]);
    for (const p of panes) expect(p.className).toContain("[grid-area:1/1]");
  });
});
