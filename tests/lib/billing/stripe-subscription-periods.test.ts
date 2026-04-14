import { describe, expect, it } from "vitest";

import {
  readSubscriptionPeriodEndUnix,
  readSubscriptionPeriodStartUnix,
} from "@/lib/billing/stripe-subscription-periods";

describe("stripe subscription periods", () => {
  it("reads period bounds from the first subscription item (Stripe API v22+)", () => {
    const subscription = {
      items: {
        data: [
          {
            current_period_start: 1_700_000_000,
            current_period_end: 1_700_086_400,
          },
        ],
      },
    } as unknown as Parameters<typeof readSubscriptionPeriodEndUnix>[0];

    expect(readSubscriptionPeriodStartUnix(subscription)).toBe(1_700_000_000);
    expect(readSubscriptionPeriodEndUnix(subscription)).toBe(1_700_086_400);
  });

  it("falls back to legacy subscription-level fields when items omit periods", () => {
    const subscription = {
      items: { data: [] },
      current_period_start: 1_710_000_000,
      current_period_end: 1_710_086_400,
    } as unknown as Parameters<typeof readSubscriptionPeriodEndUnix>[0];

    expect(readSubscriptionPeriodStartUnix(subscription)).toBe(1_710_000_000);
    expect(readSubscriptionPeriodEndUnix(subscription)).toBe(1_710_086_400);
  });
});
