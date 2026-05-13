// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MarketEventsSection } from "@/components/markets/market-events-section";
import type { EconomicCalendarSnapshot } from "@/lib/markets/economic-calendar";

afterEach(() => {
  cleanup();
});

const weeklySnapshot: EconomicCalendarSnapshot = {
  updatedAt: "2026-05-05T10:00:00.000Z",
  from: "2026-05-05",
  to: "2026-05-12",
  countries: ["US", "CN"],
  dayLabel: "Upcoming events",
  items: [
    {
      id: "us-previous-day",
      timeUtc: "2026-05-04T14:00:00.000Z",
      timeLabel: "14:00 UTC",
      country: "US",
      currency: "USD",
      event: "Previous Day Event",
      impact: "high",
      actual: null,
      forecast: null,
      previous: null,
    },
    {
      id: "us-high",
      timeUtc: "2026-05-05T14:00:00.000Z",
      timeLabel: "14:00 UTC",
      country: "US",
      currency: "USD",
      event: "ISM Services PMI",
      impact: "high",
      actual: null,
      forecast: "53.7",
      previous: "54.0",
    },
    {
      id: "cn-medium",
      timeUtc: "2026-05-09T01:30:00.000Z",
      timeLabel: "01:30 UTC",
      country: "CN",
      currency: "CNY",
      event: "CPI YY",
      impact: "medium",
      actual: null,
      forecast: "0.2%",
      previous: "0.1%",
    },
    {
      id: "us-low",
      timeUtc: "2026-05-09T18:00:00.000Z",
      timeLabel: "18:00 UTC",
      country: "US",
      currency: "USD",
      event: "Monthly Budget Statement",
      impact: "low",
      actual: null,
      forecast: null,
      previous: null,
    },
  ],
};

describe("MarketEventsSection", () => {
  it("defaults to high and medium impact events and supports country/impact filtering", () => {
    render(<MarketEventsSection snapshot={weeklySnapshot} timeZone="UTC" now={new Date("2026-05-05T12:00:00.000Z")} />);

    expect(screen.getByText("Next High Impact")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.getByText("Hr")).toBeInTheDocument();
    expect(screen.getAllByText("00")).toHaveLength(2);
    expect(screen.getByText("Min")).toBeInTheDocument();
    expect(screen.getByText("Sec")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tuesday, May 5" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Saturday, May 9" })).toBeInTheDocument();
    expect(screen.getAllByText("ISM Services PMI").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CPI YY").length).toBeGreaterThan(0);
    expect(screen.queryByText("Previous Day Event")).not.toBeInTheDocument();
    expect(screen.queryByText("Monthly Budget Statement")).not.toBeInTheDocument();
    const impactButton = screen.getByRole("button", { name: /filter events by impact/i });
    expect(within(impactButton).getByText("High")).toBeInTheDocument();
    expect(within(impactButton).getByText("Medium")).toBeInTheDocument();
    expect(impactButton).not.toHaveTextContent(",");

    fireEvent.click(screen.getByRole("button", { name: "Saturday, May 9" }));

    expect(screen.getAllByText("ISM Services PMI")).toHaveLength(1);
    expect(screen.getAllByText("CPI YY").length).toBeGreaterThan(0);

    fireEvent.pointerDown(screen.getByRole("button", { name: /filter by country/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "China (CN)" }));

    expect(screen.getAllByText("ISM Services PMI")).toHaveLength(1);
    expect(screen.getAllByText("CPI YY").length).toBeGreaterThan(0);

    fireEvent.pointerDown(screen.getByRole("button", { name: /filter events by impact/i }));
    expect(screen.queryByRole("menuitemcheckbox", { name: /high \+ medium/i })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitemcheckbox", { name: "High" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemcheckbox", { name: "Medium" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "All" }));
    fireEvent.click(screen.getByRole("button", { name: "Saturday, May 9" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: /filter by country/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "United States (US)" }));

    expect(screen.getAllByText("ISM Services PMI").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Monthly Budget Statement").length).toBeGreaterThan(0);
  });

  it("lets high and medium impact filters be selected independently", () => {
    render(<MarketEventsSection snapshot={weeklySnapshot} timeZone="UTC" now={new Date("2026-05-05T12:00:00.000Z")} />);

    fireEvent.pointerDown(screen.getByRole("button", { name: /filter events by impact/i }));
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Medium" }));

    expect(screen.getByRole("menuitemcheckbox", { name: "High" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemcheckbox", { name: "Medium" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getAllByText("ISM Services PMI").length).toBeGreaterThan(0);
    expect(screen.queryByText("CPI YY")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Medium" }));

    expect(screen.getByRole("menuitemcheckbox", { name: "High" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemcheckbox", { name: "Medium" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getAllByText("ISM Services PMI").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CPI YY").length).toBeGreaterThan(0);
    expect(screen.queryByText("Monthly Budget Statement")).not.toBeInTheDocument();
  });

  it("opens Ask prompts when an event is tapped", () => {
    const onAskPrompt = vi.fn();
    render(
      <MarketEventsSection
        snapshot={weeklySnapshot}
        timeZone="UTC"
        now={new Date("2026-05-05T12:00:00.000Z")}
        onAskPrompt={onAskPrompt}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: /ISM Services PMI/i })[0]);

    expect(onAskPrompt).toHaveBeenCalledWith(
      "ISM Services PMI is at 2:00 PM today. Estimate: 53.7. Previous: 54.0. What does this mean for my USD pairs and Gold today?",
    );
  });

  it("uses the browser time zone for dates and event times", () => {
    render(
      <MarketEventsSection
        timeZone="America/New_York"
        now={new Date("2026-05-04T16:00:00.000Z")}
        snapshot={{
          updatedAt: "2026-05-05T10:00:00.000Z",
          from: "2026-05-05",
          to: "2026-05-12",
          countries: ["US"],
          dayLabel: "Upcoming events",
          items: [
            {
              id: "us-late",
              timeUtc: "2026-05-05T00:30:00.000Z",
              timeLabel: "00:30 UTC",
              country: "US",
              currency: "USD",
              event: "Fed Speaker",
              impact: "high",
              actual: null,
              forecast: null,
              previous: null,
            },
            {
              id: "fr-extra",
              timeUtc: "2026-05-05T07:15:00.000Z",
              timeLabel: "07:15 UTC",
              country: "FR",
              currency: "EUR",
              event: "France Flash PMI",
              impact: "high",
              actual: null,
              forecast: null,
              previous: null,
            },
          ],
        }}
      />,
    );

    expect(screen.getAllByText("Fed Speaker").length).toBeGreaterThan(0);
    expect(screen.getByText("08")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("Sec")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Monday, May 4" })).toBeInTheDocument();
    expect(screen.getAllByText("8:30 PM").length).toBeGreaterThan(0);
    expect(screen.queryByText("France Flash PMI")).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Monday, May 4" })).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole("button", { name: /filter by country/i }));
    expect(screen.getByRole("menuitem", { name: "United States (US)" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /france/i })).not.toBeInTheDocument();
  });

  it("shows loading and error states instead of an empty calendar", () => {
    const { rerender } = render(<MarketEventsSection snapshot={undefined} isLoading />);

    expect(screen.getByLabelText("Loading economic calendar")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("No events match these filters.")).not.toBeInTheDocument();

    rerender(<MarketEventsSection snapshot={undefined} errorMessage="Calendar request failed." />);

    expect(screen.getByRole("alert")).toHaveTextContent("Calendar request failed.");
    expect(screen.queryByText("No events match these filters.")).not.toBeInTheDocument();
  });
});
