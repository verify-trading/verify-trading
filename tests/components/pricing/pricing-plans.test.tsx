// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
  deadlineLabel: "6 June 2026",
  free: {
    badge: "Free",
    headline: "£0",
    detail: "Free plan",
  },
  monthly: {
    badge: "Most popular",
    headline: "£24.99/month",
    detail: "Monthly Pro",
    ctaLabel: "Start Pro",
    promotion: null,
  },
  annual: {
    badge: "Best value",
    headline: "£200/year",
    detail: "Annual Pro",
    ctaLabel: "Start annual plan",
    equivalentMonthlyHeadline: "£16.67/month equivalent",
    savingsLabel: "Save £99.88 per year",
  },
} as const;

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
    expect(screen.getByRole("button", { name: "Change plan in Stripe" })).toBeInTheDocument();
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

    expect(screen.getAllByRole("link", { name: "Manage subscription" })).toHaveLength(2);
    expect(container.querySelectorAll('[data-action="checkout"]').length).toBe(0);
  });

  it("keeps the monthly promo deadline visible on the compact pricing page", () => {
    render(
      <PricingPlansSection
        pricing={{
          ...pricing,
          monthly: {
            ...pricing.monthly,
            promotion: {
              variant: "launch",
              badge: "Launch offer",
              headline: "First month £5, then £20/month",
              detail: "Launch pricing",
              priceHighlight: "£5",
              priceQualifier: "first month",
              followup: "Then £20/month",
              ctaLabel: "Join for £5",
              compareAtHeadline: "£24.99/month",
            },
          },
        }}
        compactHeader
      />,
    );

    expect(screen.getByText(/monthly offer ends 6 June 2026/i)).toBeInTheDocument();
  });
});
