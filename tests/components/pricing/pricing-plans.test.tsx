// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock("@/components/billing/billing-actions", () => ({
  BillingActionButton: ({
    action,
    payload,
    children,
  }: {
    action: string;
    payload?: Record<string, unknown>;
    children: React.ReactNode;
  }) => (
    <button type="button" data-action={action} data-payload={JSON.stringify(payload ?? null)}>
      {children}
    </button>
  ),
}));

import { PricingPlansSection } from "@/components/pricing/pricing-plans";

const pricing = {
  free: {
    badge: "Free",
    headline: "£0",
    detail: "Free plan",
  },
  weekly: {
    badge: "Flexible",
    headline: "£6.99/week",
    detail: "Weekly Pro",
    dailyEquivalentHeadline: "99p per day",
    ctaLabel: "Start weekly plan",
  },
  monthly: {
    badge: "Most popular",
    headline: "£19.99/month",
    detail: "Monthly Pro",
    dailyEquivalentHeadline: "66p per day",
    ctaLabel: "Start Pro",
  },
  annual: {
    badge: "Best value",
    headline: "£119.99/year",
    detail: "Annual Pro",
    dailyEquivalentHeadline: "33p per day",
    ctaLabel: "Start annual plan",
    equivalentMonthlyHeadline: "£10/month equivalent",
    savingsLabel: "Save £119.89 per year (6 months free)",
  },
} as const;

afterEach(() => {
  cleanup();
});

describe("PricingPlansSection", () => {
  it("shows current-plan and change-plan actions for subscribers", () => {
    const { container } = render(
      <PricingPlansSection
        pricing={pricing}
        billingContext={{
          isSignedIn: true,
          hasManageableSubscription: true,
          currentPlanKey: "annual",
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "Current plan" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Change plan in Stripe" })).toHaveLength(2);
    expect(container.querySelectorAll('[data-action="checkout"]').length).toBe(0);
    expect(screen.getByText(/subscription updates sync back to the app automatically/i)).toBeInTheDocument();
  });

  it("avoids checkout CTAs when a manageable subscription exists without a known interval", () => {
    const { container } = render(
      <PricingPlansSection
        pricing={pricing}
        billingContext={{
          isSignedIn: true,
          hasManageableSubscription: true,
          currentPlanKey: null,
        }}
      />,
    );

    expect(screen.getAllByRole("link", { name: "Manage subscription" })).toHaveLength(3);
    expect(container.querySelectorAll('[data-action="checkout"]').length).toBe(0);
  });

  it("renders weekly, monthly, and annual daily-equivalent pricing copy", () => {
    render(<PricingPlansSection pricing={pricing} compactHeader />);

    expect(screen.getAllByText("99p per day")).toHaveLength(1);
    expect(screen.getAllByText("66p per day")).toHaveLength(1);
    expect(screen.getAllByText("33p per day")).toHaveLength(1);
  });
});
