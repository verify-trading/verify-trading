// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSessionUser, mockBillingPageView, mockRedirect } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockBillingPageView: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: mockGetSessionUser,
}));

vi.mock("@/components/billing/billing-page-view", () => ({
  BillingPageView: (props: { isCanceling: boolean }) => {
    mockBillingPageView(props);
    return <div>{props.isCanceling ? "Canceling subscription" : "Active subscription"}</div>;
  },
}));

import BillingPage from "@/app/(app)/billing/page";

function createProfilesQuery(data: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const eq = vi.fn(() => ({ maybeSingle }));
  return {
    select: vi.fn(() => ({ eq })),
  };
}

function createBillingSubscriptionsQuery(data: unknown) {
  const limit = vi.fn().mockResolvedValue({ data, error: null });
  const secondOrder = vi.fn(() => ({ limit }));
  const firstOrder = vi.fn(() => ({ order: secondOrder }));
  const inFilter = vi.fn(() => ({ order: firstOrder }));
  const eq = vi.fn(() => ({ in: inFilter }));
  return {
    select: vi.fn(() => ({ eq })),
  };
}

describe("BillingPage", () => {
  beforeEach(() => {
    mockGetSessionUser.mockReset();
    mockBillingPageView.mockReset();
    mockRedirect.mockReset();

    mockGetSessionUser.mockResolvedValue({
      user: {
        id: "user-1",
        email: "test@example.com",
      },
      supabase: {
        from: vi.fn((table: string) => {
          if (table === "profiles") {
            return createProfilesQuery({ display_name: "Test", tier: "pro" });
          }

          if (table === "billing_subscriptions") {
            return createBillingSubscriptionsQuery([
              {
                status: "active",
                current_period_end: "2027-04-13T10:39:51+00:00",
                cancel_at_period_end: false,
                cancel_at: "2027-04-13T10:39:51+00:00",
                currency: "gbp",
                unit_amount: 20000,
                interval: "year",
                interval_count: 1,
              },
            ]);
          }

          throw new Error(`Unexpected table: ${table}`);
        }),
      } as never,
    } as never);
  });

  it("treats a future cancel_at date as a scheduled cancellation", async () => {
    render(await BillingPage({}));

    expect(screen.getByText("Canceling subscription")).toBeInTheDocument();
    expect(mockBillingPageView).toHaveBeenCalledWith(
      expect.objectContaining({
        isCanceling: true,
      }),
    );
  });
});
