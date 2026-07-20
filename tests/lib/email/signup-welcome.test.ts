import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/email/send-signup-welcome", () => ({
  sendSignupWelcomeEmail: vi.fn(),
}));

vi.mock("@/lib/marketing/kit", () => ({
  subscribeSignupToKit: vi.fn(),
}));

import { maybeSendSignupWelcomeEmail } from "@/lib/email/maybe-send-signup-welcome";
import { sendSignupWelcomeEmail } from "@/lib/email/send-signup-welcome";
import { subscribeSignupToKit } from "@/lib/marketing/kit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Eligibility is decided purely from these timestamps against a 10-minute window, so
// they must be relative to now rather than pinned to a date that ages out.
const justNow = new Date().toISOString();

const signupWelcomeInput = {
  userId: "user-1",
  email: "afaq@example.com",
  createdAt: justNow,
  emailConfirmedAt: justNow,
  appOrigin: "https://verify.trading",
};

function createSupabaseMock({
  welcomeSentAt = null,
  claimSucceeds = true,
}: {
  welcomeSentAt?: string | null;
  claimSucceeds?: boolean;
} = {}) {
  const updatePayloads: unknown[] = [];

  return {
    updatePayloads,
    client: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                signup_welcome_email_sent_at: welcomeSentAt,
                display_name: "Afaq",
              },
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
                data: claimSucceeds
                  ? { signup_welcome_email_sent_at: "2026-05-25T20:00:00.000Z" }
                  : null,
                error: null,
              }),
            })),
          };

          return {
            eq: updateChain.eq,
          };
        }),
      })),
    },
  };
}

describe("maybeSendSignupWelcomeEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test";
    vi.mocked(sendSignupWelcomeEmail).mockResolvedValue(undefined);
    vi.mocked(subscribeSignupToKit).mockResolvedValue(undefined);
  });

  it("claims the profile before sending the signup welcome email", async () => {
    const supabase = createSupabaseMock();
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase.client as never);

    await maybeSendSignupWelcomeEmail({
      ...signupWelcomeInput,
      displayName: null,
    });

    expect(supabase.updatePayloads).toHaveLength(1);
    expect(sendSignupWelcomeEmail).toHaveBeenCalledWith({
      email: "afaq@example.com",
      displayName: "Afaq",
      appOrigin: "https://verify.trading",
    });
  });

  it("skips profiles that already received the welcome email", async () => {
    const supabase = createSupabaseMock({
      welcomeSentAt: "2026-05-25T20:00:00.000Z",
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase.client as never);

    await maybeSendSignupWelcomeEmail(signupWelcomeInput);

    expect(sendSignupWelcomeEmail).not.toHaveBeenCalled();
    expect(supabase.updatePayloads).toHaveLength(0);
  });

  it("does not re-subscribe an already-welcomed user to Kit", async () => {
    // Regression: the Kit subscribe used to run above the `signup_welcome_email_sent_at`
    // guard, so it fired on every eligible call — i.e. every Google sign-in.
    const supabase = createSupabaseMock({
      welcomeSentAt: "2026-05-25T20:00:00.000Z",
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase.client as never);

    await maybeSendSignupWelcomeEmail(signupWelcomeInput);

    expect(subscribeSignupToKit).not.toHaveBeenCalled();
  });

  it("subscribes a first-time user to Kit", async () => {
    const supabase = createSupabaseMock();
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase.client as never);

    await maybeSendSignupWelcomeEmail(signupWelcomeInput);

    expect(subscribeSignupToKit).toHaveBeenCalledWith({
      email: "afaq@example.com",
      displayName: "Afaq",
      referrer: "https://verify.trading",
    });
  });

  it("does not claim the welcome email when Resend is not configured", async () => {
    delete process.env.RESEND_API_KEY;
    const supabase = createSupabaseMock();
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase.client as never);

    await maybeSendSignupWelcomeEmail(signupWelcomeInput);

    expect(sendSignupWelcomeEmail).not.toHaveBeenCalled();
    expect(supabase.updatePayloads).toHaveLength(0);
  });

  it("skips sending when another request already claimed the welcome email", async () => {
    const supabase = createSupabaseMock({ claimSucceeds: false });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase.client as never);

    await maybeSendSignupWelcomeEmail(signupWelcomeInput);

    expect(sendSignupWelcomeEmail).not.toHaveBeenCalled();
    expect(supabase.updatePayloads).toHaveLength(1);
  });
});
