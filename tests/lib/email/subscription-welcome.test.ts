import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/email/send-subscription-welcome", () => ({
  sendSubscriptionWelcomeEmail: vi.fn(),
}));

import { maybeSendSubscriptionWelcomeEmail } from "@/lib/email/maybe-send-subscription-welcome";
import { sendSubscriptionWelcomeEmail } from "@/lib/email/send-subscription-welcome";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const subscriptionWelcomeInput = {
  userId: "user-1",
  stripeSubscriptionId: "sub_1",
  interval: "month",
  appOrigin: "https://verify.trading",
};

function createSupabaseMock({
  welcomeSentAt = null,
  subscriptionExists = true,
}: {
  welcomeSentAt?: string | null;
  subscriptionExists?: boolean;
} = {}) {
  const updatePayloads: unknown[] = [];

  return {
    updatePayloads,
    client: {
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { email: "pro@example.com" } },
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
            const updateChain = {
              eq: vi.fn(() => updateChain),
              is: vi.fn(() => updateChain),
              select: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { welcome_email_sent_at: "2026-05-25T20:00:00.000Z" },
                  error: null,
                }),
              })),
            };

            return {
              eq: updateChain.eq,
            };
          }),
        };
      }),
    },
  };
}

describe("maybeSendSubscriptionWelcomeEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test";
    vi.mocked(sendSubscriptionWelcomeEmail).mockResolvedValue(undefined);
  });

  it("sends once with the webhook subscription interval", async () => {
    const supabase = createSupabaseMock();
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase.client as never);

    await maybeSendSubscriptionWelcomeEmail({
      ...subscriptionWelcomeInput,
      interval: "year",
    });

    expect(sendSubscriptionWelcomeEmail).toHaveBeenCalledWith({
      email: "pro@example.com",
      displayName: "Afaq",
      planKey: "annual",
      appOrigin: "https://verify.trading",
    });
    expect(supabase.updatePayloads).toHaveLength(1);
  });

  it("skips subscriptions that already received the welcome email", async () => {
    const supabase = createSupabaseMock({
      welcomeSentAt: "2026-05-25T20:00:00.000Z",
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase.client as never);

    await maybeSendSubscriptionWelcomeEmail(subscriptionWelcomeInput);

    expect(sendSubscriptionWelcomeEmail).not.toHaveBeenCalled();
    expect(supabase.updatePayloads).toHaveLength(0);
  });

  it("skips when the synced subscription row is missing", async () => {
    const supabase = createSupabaseMock({ subscriptionExists: false });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase.client as never);

    await maybeSendSubscriptionWelcomeEmail({
      ...subscriptionWelcomeInput,
      stripeSubscriptionId: "sub_missing",
    });

    expect(sendSubscriptionWelcomeEmail).not.toHaveBeenCalled();
    expect(supabase.updatePayloads).toHaveLength(0);
  });

  it("does not claim the welcome email when Resend is not configured", async () => {
    delete process.env.RESEND_API_KEY;
    const supabase = createSupabaseMock();
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase.client as never);

    await maybeSendSubscriptionWelcomeEmail(subscriptionWelcomeInput);

    expect(sendSubscriptionWelcomeEmail).not.toHaveBeenCalled();
    expect(supabase.updatePayloads).toHaveLength(0);
  });
});
