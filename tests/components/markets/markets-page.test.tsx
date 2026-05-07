// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/auth-context", () => ({
  useSupabaseAuth: vi.fn(),
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

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/markets");
      expect(screen.getAllByText("1.08542").length).toBeGreaterThan(0);
    });
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
  });

  it("defaults to Charts tab with 3 options and can switch to Events", async () => {
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
        dayLabel: "This week — 2026-05-05 to 2026-05-12",
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

    const sectionSelect = screen.getByLabelText(/markets view/i) as HTMLSelectElement;
    expect(sectionSelect.options).toHaveLength(3);
    expect(sectionSelect.value).toBe("charts");

    fireEvent.change(sectionSelect, { target: { value: "calendar" } });

    await waitFor(() => {
      expect(screen.getByText("This week — 2026-05-05 to 2026-05-12")).toBeInTheDocument();
      expect(screen.getAllByText("ISM Services PMI").length).toBeGreaterThan(0);
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

    fireEvent.change(screen.getByLabelText(/markets view/i), { target: { value: "intelligence" } });

    await waitFor(() => {
      expect(screen.getByText("Dollar steadies before Fed decision")).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/markets/intelligence");
  });
});
