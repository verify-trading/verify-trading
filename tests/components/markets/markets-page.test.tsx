// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/auth-context", () => ({
  useSupabaseAuth: vi.fn(),
}));

import { MarketsPage } from "@/components/markets/markets-page";
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

/** Routes `/api/markets/intelligence` and `/api/markets/calendar` before `/api/markets` snapshot. */
function mockFetchForMarketTabs(marketsSnapshot: Record<string, unknown>) {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
    if (url.includes("/api/markets/intelligence")) {
      return {
        ok: true,
        json: async () => ({
          updatedAt: "2026-04-09T10:00:00.000Z",
          items: [
            {
              id: "n1",
              title: "Intel test headline for Markets tab",
              source: "Reuters",
              publishedAt: "2026-04-14T08:30:00.000Z",
              summary: "Summary line",
            },
          ],
        }),
      };
    }
    if (url.includes("/api/markets/calendar")) {
      return {
        ok: true,
        json: async () => ({
          updatedAt: "2026-04-09T10:00:00.000Z",
          dayLabel: "Today — April 14, 2026",
          items: [
            {
              id: "e1",
              timeUtc: "2026-04-14T12:30:00.000Z",
              timeLabel: "12:30 UTC",
              currency: "USD",
              event: "CPI m/m",
              impact: "high",
              forecast: "0.3%",
              previous: "0.2%",
            },
          ],
        }),
      };
    }
    return {
      ok: true,
      json: async () => marketsSnapshot,
    };
  }) as unknown as typeof fetch;
}

describe("MarketsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_MARKETS_PAYWALL_UI_ENABLED", "true");
  });

  it("renders the locked preview for non-pro users without fetching live data", async () => {
    vi.mocked(useSupabaseAuth).mockReturnValue({
      supabase: null,
      user: null,
      session: null,
      ready: true,
      isSignedIn: false,
    });

    global.fetch = vi.fn() as unknown as typeof fetch;

    renderWithQueryClient(
      <MarketsPage pricing={marketsTestPricing} billingContext={signedOutBillingContext} />,
    );

    expect(screen.getByRole("heading", { level: 2, name: /top assets/i })).toBeInTheDocument();
    expect(screen.getByText("Sign in and upgrade to Pro to unlock Markets.")).toBeInTheDocument();
    expect(screen.getByText("Unlimited Ask")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /Open Gold Futures market card/i })).toBeInTheDocument();
    expect(screen.getByText("Preview mode")).toBeInTheDocument();
    expect(screen.getAllByText("4,761").length).toBeGreaterThan(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("renders the finance card grid and live detail panel for pro users", async () => {
    vi.mocked(useSupabaseAuth).mockReturnValue({
      supabase: supabaseClientForProAccountMenu() as never,
      user: { id: "user-1" } as never,
      session: {} as never,
      ready: true,
      isSignedIn: true,
    });

    mockFetchForMarketTabs({
      updatedAt: "2026-04-09T10:00:00.000Z",
      timeframe: "1W",
      assets: [
        {
          id: "nasdaq",
          label: "NASDAQ",
          error: null,
          quote: {
            asset: "NASDAQ",
            symbol: "^IXIC",
            price: 20948.12,
            changePercent: 2.89,
            direction: "up",
            isMarketOpen: null,
          },
          series: {
            asset: "NASDAQ",
            symbol: "^IXIC",
            timeframe: "1W",
            closeValues: [20100, 20280, 20410, 20680, 20948.12],
            support: 20100,
            resistance: 20948.12,
          },
        },
      ],
    });

    renderWithQueryClient(
      <MarketsPage
        initialTier="pro"
        pricing={marketsTestPricing}
        billingContext={freeSignedInBillingContext}
      />,
    );

    expect(screen.getAllByRole("heading", { level: 2, name: /top assets/i }).length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/markets?timeframe=1W");
      expect(screen.getAllByText("Focus Panel").length).toBeGreaterThan(0);
      expect(screen.getAllByText("20,948.12").length).toBeGreaterThan(0);
    });

    expect(screen.getAllByRole("button", { name: "Refresh" }).length).toBeGreaterThan(0);
  });

  it("updates the focus panel when a market card is selected", async () => {
    vi.mocked(useSupabaseAuth).mockReturnValue({
      supabase: supabaseClientForProAccountMenu() as never,
      user: { id: "user-1" } as never,
      session: {} as never,
      ready: true,
      isSignedIn: true,
    });

    mockFetchForMarketTabs({
      updatedAt: "2026-04-09T10:00:00.000Z",
      timeframe: "1W",
      assets: [
        {
          id: "oil",
          label: "OIL",
          error: null,
          quote: {
            asset: "OIL / WTI",
            symbol: "BZUSD",
            price: 94.43,
            changePercent: -13.58,
            direction: "down",
            isMarketOpen: null,
            proxyAssumption: "Using Brent crude futures as the free-plan oil proxy.",
          },
          series: {
            asset: "OIL / WTI",
            symbol: "BZUSD",
            timeframe: "1W",
            closeValues: [109.27, 104.4, 100.9, 97.8, 94.43],
            support: 94.43,
            resistance: 109.27,
            proxyAssumption: "Using Brent crude futures as the free-plan oil proxy.",
          },
        },
      ],
    });

    renderWithQueryClient(
      <MarketsPage
        initialTier="pro"
        pricing={marketsTestPricing}
        billingContext={freeSignedInBillingContext}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText("94.43").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Open Brent Crude market card" })[0]!);

    await waitFor(() => {
      const focusPanels = screen.getAllByTestId("market-focus-panel");
      expect(
        focusPanels.some((panel) => within(panel).queryByText("BZUSD · COMMODITY") !== null),
      ).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getByText("Using Brent crude futures as the free-plan oil proxy.")).toBeInTheDocument();
    });
  });

  it("defaults the section selector to Charts and can switch to Market Intelligence content", async () => {
    vi.mocked(useSupabaseAuth).mockReturnValue({
      supabase: supabaseClientForProAccountMenu() as never,
      user: { id: "user-1" } as never,
      session: {} as never,
      ready: true,
      isSignedIn: true,
    });

    mockFetchForMarketTabs({
      updatedAt: "2026-04-09T10:00:00.000Z",
      timeframe: "1W",
      assets: [
        {
          id: "gold",
          label: "GOLD",
          error: null,
          quote: {
            asset: "Gold",
            symbol: "GCUSD",
            price: 3000,
            changePercent: 1,
            direction: "up",
            isMarketOpen: null,
          },
          series: {
            asset: "Gold",
            symbol: "GCUSD",
            timeframe: "1W",
            closeValues: [2900, 2950, 3000],
            support: 2900,
            resistance: 3000,
          },
        },
      ],
    });

    renderWithQueryClient(
      <MarketsPage
        initialTier="pro"
        pricing={marketsTestPricing}
        billingContext={freeSignedInBillingContext}
      />,
    );

    const sectionSelect = screen.getByLabelText(/markets view/i) as HTMLSelectElement;
    expect(sectionSelect.options).toHaveLength(3);
    expect(sectionSelect.value).toBe("charts");
    expect(screen.getAllByRole("heading", { level: 2, name: /top assets/i }).length).toBeGreaterThan(0);

    fireEvent.change(sectionSelect, { target: { value: "intelligence" } });

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2, name: /market intelligence/i })).toBeInTheDocument();
      expect(screen.getByText(/Intel test headline for Markets tab/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/markets/intelligence");
    });
  });

  it("switches to Economic Calendar table", async () => {
    vi.mocked(useSupabaseAuth).mockReturnValue({
      supabase: supabaseClientForProAccountMenu() as never,
      user: { id: "user-1" } as never,
      session: {} as never,
      ready: true,
      isSignedIn: true,
    });

    mockFetchForMarketTabs({
      updatedAt: "2026-04-09T10:00:00.000Z",
      timeframe: "1W",
      assets: [
        {
          id: "gold",
          label: "GOLD",
          error: null,
          quote: {
            asset: "Gold",
            symbol: "GCUSD",
            price: 3000,
            changePercent: 1,
            direction: "up",
            isMarketOpen: null,
          },
          series: {
            asset: "Gold",
            symbol: "GCUSD",
            timeframe: "1W",
            closeValues: [2900, 2950, 3000],
            support: 2900,
            resistance: 3000,
          },
        },
      ],
    });

    renderWithQueryClient(
      <MarketsPage
        initialTier="pro"
        pricing={marketsTestPricing}
        billingContext={freeSignedInBillingContext}
      />,
    );

    const sectionSelect = screen.getByLabelText(/markets view/i) as HTMLSelectElement;
    fireEvent.change(sectionSelect, { target: { value: "calendar" } });

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2, name: /economic calendar/i })).toBeInTheDocument();
      expect(screen.getByText("CPI m/m")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/markets/calendar");
    });
  });
});
