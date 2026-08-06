import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/billing/stripe-server", () => ({
  getStripeServerClient: vi.fn(),
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { ensureStripeCustomerForUser, stripeErrorMeta } from "@/lib/billing/repository";
import { getStripeServerClient } from "@/lib/billing/stripe-server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/** Minimal `profiles` double: one read for the billing profile, one update for the new id. */
function mockProfiles(stripeCustomerId: string | null) {
  const patches: Record<string, unknown>[] = [];
  vi.mocked(getSupabaseAdminClient).mockReturnValue({
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: "user-1", display_name: "Ada", stripe_customer_id: stripeCustomerId },
            error: null,
          }),
        }),
      }),
      update: (patch: Record<string, unknown>) => {
        patches.push(patch);
        return { eq: async () => ({ error: null }) };
      },
    })),
  } as never);
  return patches;
}

function stripeError(code: string) {
  return Object.assign(new Error(`No such customer; code ${code}`), { code, statusCode: 404 });
}

describe("ensureStripeCustomerForUser", () => {
  const update = vi.fn();
  const create = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    create.mockResolvedValue({ id: "cus_new" });
    vi.mocked(getStripeServerClient).mockReturnValue({
      customers: { update, create },
    } as never);
  });

  it("replaces a stored customer Stripe no longer has, so checkout heals itself", async () => {
    // Exactly the live failure: the row still points at a test-mode customer from before the
    // switch to live keys, so Stripe answers 404 resource_missing.
    const patches = mockProfiles("cus_from_test_mode");
    update.mockRejectedValue(stripeError("resource_missing"));

    const customerId = await ensureStripeCustomerForUser({
      userId: "user-1",
      email: "ada@example.com",
      displayName: "Ada",
    });

    expect(customerId).toBe("cus_new");
    expect(create).toHaveBeenCalledTimes(1);
    // The row is rewritten, so the repair survives the request — no SQL, no second failure.
    expect(patches).toContainEqual({ stripe_customer_id: "cus_new" });
  });

  it("rethrows a real Stripe failure instead of minting a duplicate customer", async () => {
    // The dangerous version of this fix treats every error as staleness and quietly creates a
    // second customer on a rate limit or an outage, orphaning the subscription history.
    mockProfiles("cus_live_and_fine");
    update.mockRejectedValue(stripeError("rate_limit"));

    await expect(
      ensureStripeCustomerForUser({
        userId: "user-1",
        email: "ada@example.com",
        displayName: "Ada",
      }),
    ).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it("keeps Stripe's request id in the log meta, so the next failure is traceable", () => {
    // The request id is what opens the exact call in Stripe's dashboard logs. Everything else in
    // the error is noise we already have; losing this one turns a diagnosis into an interview.
    expect(stripeErrorMeta(stripeError("resource_missing"))).toEqual({
      stripeCode: "resource_missing",
      stripeStatus: 404,
    });
    expect(
      stripeErrorMeta(Object.assign(new Error("nope"), { requestId: "req_1", type: "invalid_request_error" })),
    ).toEqual({ stripeRequestId: "req_1", stripeType: "invalid_request_error" });
    // Never throws on whatever it is handed — it runs inside a catch block.
    expect(stripeErrorMeta(null)).toEqual({});
    expect(stripeErrorMeta("boom")).toEqual({});
  });

  it("leaves a healthy stored customer alone", async () => {
    mockProfiles("cus_live_and_fine");
    update.mockResolvedValue({ id: "cus_live_and_fine" });

    const customerId = await ensureStripeCustomerForUser({
      userId: "user-1",
      email: "ada@example.com",
      displayName: "Ada",
    });

    expect(customerId).toBe("cus_live_and_fine");
    expect(create).not.toHaveBeenCalled();
  });
});
