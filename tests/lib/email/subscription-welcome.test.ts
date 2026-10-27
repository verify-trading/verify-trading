import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/email/lifecycle/send", () => ({
  sendLifecycleEmail: vi.fn(),
}));

import { sendLifecycleEmail } from "@/lib/email/lifecycle/send";
import { maybeSendSubscriptionWelcomeEmail, retrySubscriptionWelcomeEmails } from "@/lib/email/maybe-send-subscription-welcome";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const subscriptionWelcomeInput = {
  userId: "user-1",
  stripeSubscriptionId: "sub_1",
};

function createSupabaseMock({
  welcomeSentAt = null,
  subscriptionExists = true,
  email = "pro@example.com" as string | null,
}: {
  welcomeSentAt?: string | null;
  subscriptionExists?: boolean;
  email?: string | null;
} = {}) {
  const updatePayloads: unknown[] = [];

  return {
    updatePayloads,
    client: {
      rpc: vi.fn().mockResolvedValue({ data: [{ user_id: "user-1", stripe_subscription_id: "sub_1" }], error: null }),
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { email } },
            error: null,
          }),
        },
      },
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { display_name: "Afaq" },
                  error: null,
                }),
              })),
            })),
          };
        }

        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: subscriptionExists
                  ? {
                      welcome_email_sent_at: welcomeSentAt,
                    }
                  : null,
                error: null,
              }),
            })),
          })),
          update: vi.fn((payload: unknown) => {
            updatePayloads.push(payload);
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
        };
      }),
    },
  };
}

describe("maybeSendSubscriptionWelcomeEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sendLifecycleEmail).mockResolvedValue("sent");
  });

  it("sends C5 once through the lifecycle sender", async () => {
    const supabase = createSupabaseMock();
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase.client as never);

    await maybeSendSubscriptionWelcomeEmail(subscriptionWelcomeInput);

    expect(sendLifecycleEmail).toHaveBeenCalledWith({
      userId: "user-1",
      to: "pro@example.com",
      emailId: "c5",
      dedupeKey: "c5:sub_1",
      kind: "transactional",
      variant: null,
      vars: { firstName: "Afaq" },
    });
    expect(supabase.updatePayloads).toHaveLength(1);
  });

  it("stamps welcome_email_sent_at when the email was sent", async () => {
    vi.mocked(sendLifecycleEmail).mockResolvedValue("sent");
    const supabase = createSupabaseMock();
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase.client as never);

    await maybeSendSubscriptionWelcomeEmail(subscriptionWelcomeInput);

    expect(supabase.updatePayloads).toEqual([{ welcome_email_sent_at: expect.any(String) }]);
  });

  it.each(["failed", "skipped"] as const)("does not stamp when the send result is %s", async (result) => {
    vi.mocked(sendLifecycleEmail).mockResolvedValue(result);
    const supabase = createSupabaseMock();
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase.client as never);

    await maybeSendSubscriptionWelcomeEmail(subscriptionWelcomeInput);

    expect(supabase.updatePayloads).toHaveLength(0);
  });

  it("skips subscriptions that already received the welcome email", async () => {
    const supabase = createSupabaseMock({
      welcomeSentAt: "2026-05-25T20:00:00.000Z",
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase.client as never);

    await maybeSendSubscriptionWelcomeEmail(subscriptionWelcomeInput);

    expect(sendLifecycleEmail).not.toHaveBeenCalled();
    expect(supabase.updatePayloads).toHaveLength(0);
  });

  it("skips when the synced subscription row is missing", async () => {
    const supabase = createSupabaseMock({ subscriptionExists: false });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase.client as never);

    await maybeSendSubscriptionWelcomeEmail({
      ...subscriptionWelcomeInput,
      stripeSubscriptionId: "sub_missing",
    });

    expect(sendLifecycleEmail).not.toHaveBeenCalled();
    expect(supabase.updatePayloads).toHaveLength(0);
  });

  it("does not send when the user has no email address", async () => {
    const supabase = createSupabaseMock({ email: null });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase.client as never);

    await maybeSendSubscriptionWelcomeEmail(subscriptionWelcomeInput);

    expect(sendLifecycleEmail).not.toHaveBeenCalled();
    expect(supabase.updatePayloads).toHaveLength(0);
  });
});

it("repairs a missing subscription stamp after a previously completed send", async () => {
  vi.mocked(sendLifecycleEmail).mockResolvedValue("duplicate");
  const supabase = createSupabaseMock();
  vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase.client as never);
  await maybeSendSubscriptionWelcomeEmail(subscriptionWelcomeInput);
  expect(supabase.updatePayloads).toEqual([{ welcome_email_sent_at: expect.any(String) }]);
});

it("recovers a failed welcome from the subscription row on a later cron run", async () => {
  vi.clearAllMocks();
  const supabase = createSupabaseMock();
  vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase.client as never);
  vi.mocked(sendLifecycleEmail).mockResolvedValueOnce("failed").mockResolvedValueOnce("sent");

  expect(await retrySubscriptionWelcomeEmails(15)).toBe(1);
  expect(supabase.updatePayloads).toHaveLength(0);
  expect(await retrySubscriptionWelcomeEmails(15)).toBe(1);
  expect(sendLifecycleEmail).toHaveBeenCalledTimes(2);
  expect(supabase.client.rpc).toHaveBeenCalledWith("lifecycle_pending_subscription_welcomes", {
    p_since: "2026-10-15T00:00:00Z", p_limit: 15,
  });
  expect(supabase.updatePayloads).toEqual([{ welcome_email_sent_at: expect.any(String) }]);
});
