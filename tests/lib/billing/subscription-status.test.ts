import { describe, expect, it } from "vitest";

import {
  billingStatusGrantsProAccess,
  canManageSubscription,
  getBillingStatusLabel,
} from "@/lib/billing/subscription-status";

describe("subscription status helpers", () => {
  it("keeps Pro access for active, trialing, and past_due subscriptions", () => {
    expect(billingStatusGrantsProAccess("active")).toBe(true);
    expect(billingStatusGrantsProAccess("trialing")).toBe(true);
    expect(billingStatusGrantsProAccess("past_due")).toBe(true);
    expect(billingStatusGrantsProAccess("canceled")).toBe(false);
    expect(billingStatusGrantsProAccess(null)).toBe(false);
  });

  it("allows management only for live or recoverable subscriptions", () => {
    expect(canManageSubscription("active")).toBe(true);
    expect(canManageSubscription("incomplete")).toBe(true);
    expect(canManageSubscription("unpaid")).toBe(true);
    expect(canManageSubscription("canceled")).toBe(false);
    expect(canManageSubscription("incomplete_expired")).toBe(false);
  });

  it("formats human-readable labels", () => {
    expect(getBillingStatusLabel("past_due")).toBe("Past due");
    expect(getBillingStatusLabel("trialing")).toBe("Trialing");
    expect(getBillingStatusLabel(undefined)).toBe("Free");
  });
});
