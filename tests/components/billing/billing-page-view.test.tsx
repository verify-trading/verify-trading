// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock("@/components/billing/billing-actions", () => ({
  BillingActionButton: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  BillingCheckoutSync: () => null,
}));

import { BillingPageView } from "@/components/billing/billing-page-view";
import { getPublicBillingPricing } from "@/lib/billing/config";
import { PRO_PLAN_FEATURES } from "@/lib/marketing/pro-plan-features";

describe("BillingPageView", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows 'Ends on' when the subscription is scheduled to cancel", () => {
    render(
      <BillingPageView
        customerName="Test"
        currentPlanLabel="Pro Annual"
        state={{
          canOpenBillingPortal: true,
          canManageSubscriptionActions: true,
          showSubscriptionManagement: true,
          isCanceling: true,
        }}
        renewalDate="13 Apr 2027"
        recurringAmount="£200.00/year"
        subscription={{
          status: "active",
          current_period_end: "2027-04-13T10:39:51+00:00",
          cancel_at_period_end: false,
          currency: "gbp",
          unit_amount: 20000,
          interval: "year",
          interval_count: 1,
        }}
        freeAskUsage={null}
        checkoutState={null}
        checkoutSessionId={null}
      />,
    );

    expect(screen.getByText("Cancels at the end of the current billing period.")).toBeInTheDocument();
    expect(screen.getByText("Ends on")).toBeInTheDocument();
    expect(screen.queryByText("Renews on")).not.toBeInTheDocument();
  });

  it("shows free plan usage and upgrade path when not subscribed", () => {
    render(
      <BillingPageView
        customerName="Test"
        currentPlanLabel="Free"
        state={{
          canOpenBillingPortal: false,
          canManageSubscriptionActions: false,
          showSubscriptionManagement: false,
          isCanceling: false,
        }}
        renewalDate={null}
        recurringAmount={null}
        subscription={null}
        freeAskUsage={{
          used: 4,
          remaining: 1,
          limit: 5,
          progressPercent: 80,
        }}
        checkoutState={null}
        checkoutSessionId={null}
      />,
    );

    expect(screen.getByText("Daily Ask usage")).toBeInTheDocument();
    expect(screen.getByText("4/5")).toBeInTheDocument();
    expect(screen.getByText(/1 free message left today/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View pricing & upgrade/i })).toHaveAttribute("href", "/pricing");

    // Someone deciding whether to pay has to be able to see what they get. This card used to
    // sell Pro as "Stripe-managed billing" and 15 more Ask messages, which reads as no reason
    // at all — every Pro feature is listed here now, from the same source as the pricing page.
    for (const feature of PRO_PLAN_FEATURES) {
      expect(screen.getByText(feature)).toBeInTheDocument();
    }
    expect(screen.getByText(getPublicBillingPricing().monthly.headline)).toBeInTheDocument();
    expect(screen.queryByText(/Stripe-managed billing/i)).not.toBeInTheDocument();
  });

  it("shows subscription details for Pro users even when portal actions are unavailable", () => {
    render(
      <BillingPageView
        customerName="Test"
        currentPlanLabel="Pro"
        state={{
          canOpenBillingPortal: true,
          canManageSubscriptionActions: false,
          showSubscriptionManagement: true,
          isCanceling: false,
        }}
        renewalDate="13 Apr 2027"
        recurringAmount="£20.00/month"
        subscription={{
          status: "active",
          current_period_end: "2027-04-13T10:39:51+00:00",
          cancel_at_period_end: false,
          currency: "gbp",
          unit_amount: 2000,
          interval: "month",
          interval_count: 1,
        }}
        freeAskUsage={null}
        checkoutState={null}
        checkoutSessionId={null}
      />,
    );

    expect(screen.getByRole("heading", { name: "Billing" })).toBeInTheDocument();
    expect(screen.getByText("Pro", { selector: "p.text-lg" })).toBeInTheDocument();
    expect(screen.getByText("£20.00/month")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Manage in Stripe/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View pricing & upgrade/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cancel at period end/i })).not.toBeInTheDocument();
  });
});
