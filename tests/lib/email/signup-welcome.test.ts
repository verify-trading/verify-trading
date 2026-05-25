import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/email/send-signup-welcome", () => ({
  sendSignupWelcomeEmail: vi.fn(),
}));

import { maybeSendSignupWelcomeEmail } from "@/lib/email/maybe-send-signup-welcome";
import { sendSignupWelcomeEmail } from "@/lib/email/send-signup-welcome";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const signupWelcomeInput = {
  userId: "user-1",
  email: "afaq@example.com",
  oauthFlow: "signup" as const,
  createdAt: "2026-05-25T20:00:00.000Z",
  emailConfirmedAt: "2026-05-25T20:00:10.000Z",
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
