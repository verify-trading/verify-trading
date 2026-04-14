// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetPricingPageData, mockLandingPage } = vi.hoisted(() => ({
  mockGetPricingPageData: vi.fn(),
  mockLandingPage: vi.fn(),
}));

vi.mock("@/lib/billing/pricing-page-data", () => ({
  getPricingPageData: mockGetPricingPageData,
}));

vi.mock("@/components/landing/landing-page", () => ({
  LandingPage: ({
    billingContext,
  }: {
    billingContext: { isSignedIn: boolean; hasManageableSubscription: boolean; currentPlanKey: string | null } | null;
    pricing: ReactNode;
  }) => {
    mockLandingPage({ billingContext });
    return <div>{billingContext?.isSignedIn ? "Signed in landing" : "Signed out landing"}</div>;
  },
}));

import Home from "@/app/page";

describe("Home page", () => {
  beforeEach(() => {
    mockGetPricingPageData.mockReset();
    mockLandingPage.mockReset();
  });

  it("passes subscription-aware billing context into the landing page", async () => {
    mockGetPricingPageData.mockResolvedValue({
      pricing: {
        deadlineLabel: "6 June 2026",
        free: { badge: "Free", headline: "£0", detail: "Free" },
        monthly: { badge: "Most popular", headline: "£24.99/month", detail: "Monthly", ctaLabel: "Start Pro", promotion: null },
        annual: {
          badge: "Best value",
          headline: "£200/year",
          detail: "Annual",
          ctaLabel: "Start annual plan",
          equivalentMonthlyHeadline: "£16.67/month equivalent",
          savingsLabel: "Save £99.88 per year",
        },
      },
      billingContext: {
        isSignedIn: true,
        hasManageableSubscription: true,
        currentPlanKey: "annual",
      },
    });

    render(await Home());

    expect(screen.getByText("Signed in landing")).toBeInTheDocument();
    expect(mockLandingPage).toHaveBeenCalledWith({
      billingContext: {
        isSignedIn: true,
        hasManageableSubscription: true,
        currentPlanKey: "annual",
      },
    });
  });
});
