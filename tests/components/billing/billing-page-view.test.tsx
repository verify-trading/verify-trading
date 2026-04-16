// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock("@/components/billing/billing-actions", () => ({
  BillingActionButton: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  BillingCheckoutSync: () => null,
}));

import { BillingPageView } from "@/components/billing/billing-page-view";

describe("BillingPageView", () => {
  it("shows 'Ends on' when the subscription is scheduled to cancel", () => {
    render(
      <BillingPageView
        customerName="Test"
        currentPlanLabel="Pro Annual"
        canOpenPortal
        isCanceling
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
        canOpenPortal={false}
        isCanceling={false}
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
  });
});
