// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/auth-context", () => ({
  useSupabaseAuth: vi.fn(),
}));

const mockRouterPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

import { TwelveMarketsPage } from "@/components/markets/twelve-markets-page";
import { getPublicBillingPricing } from "@/lib/billing/config";
import type { PricingPageBillingContext } from "@/lib/billing/pricing-page-data";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";

const marketsTestPricing = getPublicBillingPricing();
const signedOutBillingContext: PricingPageBillingContext = {
  isSignedIn: false,
  hasManageableSubscription: false,
  currentPlanKey: null,
};
const freeSignedInBillingContext: PricingPageBillingContext = {
  isSignedIn: true,
  hasManageableSubscription: false,
  currentPlanKey: null,
};

/** Matches `loadAccountMenuState` for a Pro user (no `usage_limits` call). */
function supabaseClientForProAccountMenu() {
  const profileRow = {
    display_name: "Test",
    username: "test",
    tier: "pro",
    created_at: "2026-01-01T00:00:00.000Z",
    preferences: null as Record<string, unknown> | null,
  };
  const maybeSingleProfiles = vi.fn().mockResolvedValue({ data: profileRow, error: null });
  const selectEqProfiles = vi.fn().mockReturnValue({ maybeSingle: maybeSingleProfiles });
  const selectProfiles = vi.fn().mockReturnValue({ eq: selectEqProfiles });
  const from = vi.fn().mockReturnValue({ select: selectProfiles });
  return { from };
}

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function mockFetchMarkets(
  marketsSnapshot: Record<string, unknown>,
  calendarSnapshot?: Record<string, unknown>,
  intelligenceSnapshot?: Record<string, unknown>,
) {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
    if (url === "/api/markets") {
      return {
        ok: true,
        json: async () => marketsSnapshot,
      };
    }
    if (url === "/api/markets/calendar") {
      return {
        ok: true,
        json: async () =>
          calendarSnapshot ?? {
            updatedAt: new Date().toISOString(),
            dayLabel: "Today — Test Date",
            items: [],
          },
      };
    }
    if (url === "/api/markets/intelligence") {
      return {
        ok: true,
        json: async () =>
          intelligenceSnapshot ?? {
            updatedAt: new Date().toISOString(),
            items: [],
          },
      };
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;
}

describe("TwelveMarketsPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
    mockRouterPush.mockReset();
  });

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_MARKETS_PAYWALL_UI_ENABLED", "true");
  });

  it("renders the paywall for non-pro users without fetching live data", async () => {
    vi.mocked(useSupabaseAuth).mockReturnValue({
      supabase: null,
      user: null,
      session: null,
      ready: true,
      isSignedIn: false,
    });

    global.fetch = vi.fn() as unknown as typeof fetch;

    renderWithQueryClient(
      <TwelveMarketsPage pricing={marketsTestPricing} billingContext={signedOutBillingContext} />,
    );

    expect(screen.getByText("Sign in and upgrade to Pro to unlock Markets.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Major Pairs" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Commodities" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crypto" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Indices" })).toBeInTheDocument();

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("renders category tabs and fetches live data for pro users", async () => {
    vi.mocked(useSupabaseAuth).mockReturnValue({
      supabase: supabaseClientForProAccountMenu() as never,
      user: { id: "user-1" } as never,
      session: {} as never,
      ready: true,
      isSignedIn: true,
    });

    mockFetchMarkets({
      updatedAt: "2026-04-09T10:00:00.000Z",
      quotes: {
        "EUR/USD": {
          symbol: "EUR/USD",
          name: "Euro / US Dollar",
          price: 1.08542,
          change: 0.0023,
          percent_change: 0.21,
          open: 1.08312,
          high: 1.08651,
          low: 1.08234,
          previous_close: 1.08312,
          is_market_open: true,
          exchange: "FOREX",
        },
      },
      sparklines: {
        "EUR/USD": [1.082, 1.083, 1.084, 1.085, 1.08542],
      },
    });

    renderWithQueryClient(
      <TwelveMarketsPage
        initialTier="pro"
        pricing={marketsTestPricing}
        billingContext={freeSignedInBillingContext}
      />,
    );

    expect(screen.getByRole("button", { name: "Major Pairs" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Commodities" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crypto" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Indices" })).toBeInTheDocument();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/markets");
      expect(screen.getAllByText("1.08542").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: /EUR\/USD/i }));

    expect(mockRouterPush).toHaveBeenCalledWith(
      "/ask?prefill=Brief%20me%20on%20EUR%2FUSD%20before%20this%20session.%20Key%20levels%2C%20bias%20and%20what%20to%20watch.",
    );
  });

  it("switches active category when a category button is clicked", async () => {
    vi.mocked(useSupabaseAuth).mockReturnValue({
      supabase: supabaseClientForProAccountMenu() as never,
      user: { id: "user-1" } as never,
      session: {} as never,
      ready: true,
      isSignedIn: true,
    });

    mockFetchMarkets({
      updatedAt: "2026-04-09T10:00:00.000Z",
      quotes: {},
      sparklines: {},
    });

    renderWithQueryClient(
      <TwelveMarketsPage
        initialTier="pro"
        pricing={marketsTestPricing}
        billingContext={freeSignedInBillingContext}
      />,
    );

    expect(screen.getByRole("button", { name: "Major Pairs" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Commodities" }));

    await waitFor(() => {
      expect(screen.getByText("XAU/USD")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Indices" }));

    await waitFor(() => {
      expect(screen.getByText("Nasdaq")).toBeInTheDocument();
    });
  });

  it("defaults to Charts tab with 5 options and can switch to Economic Calendar", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-05-05T12:00:00.000Z"));
    vi.mocked(useSupabaseAuth).mockReturnValue({
      supabase: supabaseClientForProAccountMenu() as never,
      user: { id: "user-1" } as never,
      session: {} as never,
      ready: true,
      isSignedIn: true,
    });

    mockFetchMarkets(
      {
        updatedAt: "2026-04-09T10:00:00.000Z",
        quotes: {},
        sparklines: {},
      },
      {
        updatedAt: "2026-04-09T10:00:00.000Z",
        dayLabel: "Upcoming events",
        items: [
          {
            id: "event-1",
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
        ],
      },
    );

    renderWithQueryClient(
      <TwelveMarketsPage
        initialTier="pro"
        pricing={marketsTestPricing}
        billingContext={freeSignedInBillingContext}
      />,
    );

    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.getByRole("tab", { name: /markets/i })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("tab", { name: /economic calendar/i }));

    await waitFor(() => {
      expect(screen.getAllByText("ISM Services PMI").length).toBeGreaterThan(0);
      expect(screen.getByText("2h 0m")).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/markets/calendar");
  });

  it("can switch to market intelligence and render NewsData headlines", async () => {
    vi.mocked(useSupabaseAuth).mockReturnValue({
      supabase: supabaseClientForProAccountMenu() as never,
      user: { id: "user-1" } as never,
      session: {} as never,
      ready: true,
      isSignedIn: true,
    });

    mockFetchMarkets(
      {
        updatedAt: "2026-04-09T10:00:00.000Z",
        quotes: {},
        sparklines: {},
      },
      undefined,
      {
        updatedAt: "2026-05-05T10:00:00.000Z",
        dailyBrief: {
          date: "2026-05-05",
          generatedAt: "2026-05-05T08:00:00.000Z",
          overview: "Dollar strength is steering the session.",
          gold: { level: "2380", bias: "Bullish", verdict: "Gold is firm." },
          oil: { level: "84.20", bias: "Bullish", verdict: "Oil is firm." },
          dxy: { level: "105.20", bias: "Bullish", verdict: "Dollar bid controls risk." },
          usdjpy: { level: "157.20", bias: "Bullish", verdict: "Yields are driving USD/JPY." },
          eurusd: { level: "1.0820", bias: "Bearish", verdict: "Dollar pressure is showing." },
          gbpusd: { level: "1.2850", bias: "Bearish", verdict: "Sterling is soft." },
          session_tone: "Dollar strength is the main focus.",
        },
        items: [
          {
            id: "n1",
            title: "Dollar steadies before Fed decision",
            source: "Reuters",
            publishedAt: new Date().toISOString(),
            summary: "Markets wait for the Fed.",
            url: "https://example.com/news",
            tag: "FX",
          },
        ],
      },
    );

    renderWithQueryClient(
      <TwelveMarketsPage
        initialTier="pro"
        pricing={marketsTestPricing}
        billingContext={freeSignedInBillingContext}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /intelligence/i }));

    await waitFor(() => {
      expect(screen.getByText("Dollar steadies before Fed decision")).toBeInTheDocument();
      expect(screen.getByText("DXY")).toBeInTheDocument();
      expect(screen.getByText("USD/JPY")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Dollar steadies before Fed decision/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /Ask about this/i }).at(-1)!);

    expect(mockRouterPush).toHaveBeenCalledWith(
      "/ask?prefill=Dollar%20steadies%20before%20Fed%20decision%20%E2%80%94%20what%20does%20this%20mean%20for%20my%20trades%20today%3F",
    );
    expect(global.fetch).toHaveBeenCalledWith("/api/markets/intelligence");
  });

  it("renders the current-state artwork for Journal and Mind placeholders", async () => {
    vi.mocked(useSupabaseAuth).mockReturnValue({
      supabase: supabaseClientForProAccountMenu() as never,
      user: { id: "user-1" } as never,
      session: {} as never,
      ready: true,
      isSignedIn: true,
    });

    mockFetchMarkets({
      updatedAt: "2026-04-09T10:00:00.000Z",
      quotes: {},
      sparklines: {},
    });

    renderWithQueryClient(
      <TwelveMarketsPage
        initialTier="pro"
        pricing={marketsTestPricing}
        billingContext={freeSignedInBillingContext}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /journal/i }));

    expect(screen.getByText("Trading Journal")).toBeInTheDocument();
    expect(screen.getByTestId("journal-state-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("mind-state-orb")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /mind/i }));

    expect(screen.getByText("Psychological AI")).toBeInTheDocument();
    expect(screen.getByTestId("mind-state-orb")).toBeInTheDocument();
    expect(screen.getByLabelText("Plasma mind orb")).toBeInTheDocument();
    expect(screen.queryByTestId("journal-state-icon")).not.toBeInTheDocument();
  });
});
