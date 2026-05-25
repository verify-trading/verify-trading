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
        free: { badge: "Free", headline: "£0", detail: "Free" },
        weekly: {
          badge: "Flexible",
          headline: "£6.99/week",
          detail: "Weekly",
          dailyEquivalentHeadline: "99p per day",
          ctaLabel: "Start weekly plan",
        },
        monthly: {
          badge: "Most popular",
          headline: "£19.99/month",
          detail: "Monthly",
          dailyEquivalentHeadline: "66p per day",
          ctaLabel: "Start Pro",
        },
        annual: {
          badge: "Best value",
          headline: "£119.99/year",
          detail: "Annual",
          dailyEquivalentHeadline: "33p per day",
          ctaLabel: "Start annual plan",
          equivalentMonthlyHeadline: "£10/month equivalent",
          savingsLabel: "Save £119.89 per year (6 months free)",
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
