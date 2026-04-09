// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/auth-context", () => ({
  useSupabaseAuth: vi.fn(),
}));

import { MarketsPage } from "@/components/markets/markets-page";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";

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

describe("MarketsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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

    renderWithQueryClient(<MarketsPage />);

    expect(screen.getByText("Top Assets")).toBeInTheDocument();
    expect(screen.getByText("Pro Access")).toBeInTheDocument();
    expect(screen.getByText("Sign in and upgrade to Pro to unlock Markets.")).toBeInTheDocument();
    expect(screen.getByText("20,948.12")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("renders the finance card grid and live detail panel for pro users", async () => {
    vi.mocked(useSupabaseAuth).mockReturnValue({
      supabase: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { tier: "pro" },
                error: null,
              }),
            }),
          }),
        }),
      } as never,
      user: { id: "user-1" } as never,
      session: {} as never,
      ready: true,
      isSignedIn: true,
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
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
      }),
    }) as unknown as typeof fetch;

    renderWithQueryClient(<MarketsPage />);

    expect(screen.getAllByText("Top Assets").length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/markets?timeframe=1W");
      expect(screen.getAllByText("Focus Panel").length).toBeGreaterThan(0);
      expect(screen.getAllByText("20,948.12").length).toBeGreaterThan(0);
    });

    expect(screen.getAllByRole("button", { name: "Refresh" }).length).toBeGreaterThan(0);
  });

  it("updates the focus panel when a market card is selected", async () => {
    vi.mocked(useSupabaseAuth).mockReturnValue({
      supabase: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { tier: "pro" },
                error: null,
              }),
            }),
          }),
        }),
      } as never,
      user: { id: "user-1" } as never,
      session: {} as never,
      ready: true,
      isSignedIn: true,
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
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
            },
            series: {
              asset: "OIL / WTI",
              symbol: "BZUSD",
              timeframe: "1W",
              closeValues: [109.27, 104.4, 100.9, 97.8, 94.43],
              support: 94.43,
              resistance: 109.27,
            },
          },
        ],
      }),
    }) as unknown as typeof fetch;

    renderWithQueryClient(<MarketsPage />);

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
  });
});
