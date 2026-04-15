// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AskResponseCard } from "@/components/ask/cards";

describe("AskResponseCard", () => {
  it("renders the inline market mini chart when briefing ui metadata is present", () => {
    render(
      <AskResponseCard
        card={{
          type: "briefing",
          asset: "Gold / XAUUSD",
          price: "$4,493",
          change: "+0.8%",
          direction: "up",
          level1: "4,505",
          level2: "4,470",
          event: null,
          verdict: "Gold is holding above the morning base.",
        }}
        uiMeta={{
          marketSeries: [4470, 4485, 4493],
          marketLevelScopeLabel: "Near-term levels",
        }}
      />,
    );

    expect(screen.getByTestId("market-mini-chart")).toBeInTheDocument();
    expect(screen.getByText("Near-term levels Resistance")).toBeInTheDocument();
  });

  it("renders projection loss markers when projection ui metadata is present", () => {
    const { container } = render(
      <AskResponseCard
        card={{
          type: "projection",
          months: 6,
          startBalance: 10000,
          monthlyAdd: 500,
          projectedBalance: 14500,
          dataPoints: [10000, 10400, 10850, 11600, 12900, 14500],
          totalReturn: "45%",
          lossEvents: 2,
          verdict: "The curve is healthy if you protect drawdown.",
        }}
        uiMeta={{
          projectionMarkers: [1, 3],
        }}
      />,
    );

    expect(screen.getByTestId("projection-curve")).toBeInTheDocument();
    expect(container.querySelectorAll("circle")).toHaveLength(2);
  });

  it("renders prop firms without a misleading FCA label", () => {
    render(
      <AskResponseCard
        card={{
          type: "broker",
          name: "FTMO",
          score: "9.1",
          status: "LEGITIMATE",
          fca: "No",
          complaints: "Low",
          verdict:
            "Most trusted prop firm globally. Consistent payouts. Strong community reputation. Not FCA-regulated because it is a prop firm, not a retail broker.",
          color: "green",
        }}
        uiMeta={{
          verificationKind: "propfirm",
          verificationSourceLabel: "Reviewed record",
        }}
      />,
    );

    expect(screen.getByText("Firm Check")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Prop Firm")).toBeInTheDocument();
    expect(screen.getByText("Reviewed record")).toBeInTheDocument();
    expect(screen.queryByText("FCA")).not.toBeInTheDocument();
  });

  it("renders projection stat tiles with the card's currencySymbol instead of hardcoded £", () => {
    const { container } = render(
      <AskResponseCard
        card={{
          type: "projection",
          months: 6,
          startBalance: 500,
          monthlyAdd: 100,
          currencySymbol: "$",
          projectedBalance: 1200,
          dataPoints: [500, 615, 733, 855, 981, 1200],
          totalReturn: "60.0%",
          lossEvents: 2,
          verdict: "Base case with dollar amounts.",
        }}
      />,
    );

    expect(screen.getByText("$500")).toBeInTheDocument();
    expect(screen.getByText("$100")).toBeInTheDocument();
    expect(screen.getByText(/\$1,200/)).toBeInTheDocument();

    // Stat tiles should not contain £ — check non-SVG text nodes only
    // (Recharts SVG tspans from prior test renders can leak in JSDOM)
    const statTiles = container.querySelectorAll("[class*='rounded-xl']");
    const tileTexts = Array.from(statTiles).map((el) => el.textContent ?? "");
    expect(tileTexts.some((t) => t.includes("£"))).toBe(false);
  });
});
