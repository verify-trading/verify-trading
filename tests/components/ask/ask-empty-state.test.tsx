// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AskEmptyState } from "@/components/ask/ask-empty-state";

vi.mock("@/components/ask/ask-skeletons", () => ({
  AskEmptyRestoringSkeleton: () => <div>Loading</div>,
}));

describe("AskEmptyState", () => {
  it("keeps suggestion prompts in a horizontally scrollable strip on narrow layouts", () => {
    render(
      <AskEmptyState
        isLoadingHistory={false}
        prompts={["First question", "Second question"]}
        onPromptClick={vi.fn()}
      />,
    );

    const suggestions = screen.getAllByRole("list", { name: "Suggested questions" });

    expect(suggestions).toHaveLength(2);
    expect(suggestions[0]).toHaveClass("flex", "overflow-x-auto", "snap-x");
    expect(suggestions[1]).toHaveClass("flex", "overflow-x-auto", "snap-x");
    expect(screen.getAllByRole("button", { name: "First question" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Second question" })).toHaveLength(2);
  });
});
