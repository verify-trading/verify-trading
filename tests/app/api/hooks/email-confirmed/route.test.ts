import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/email/maybe-send-signup-welcome", () => ({
  maybeSendSignupWelcomeEmail: vi.fn(),
}));

import { POST } from "@/app/api/hooks/email-confirmed/route";
import { maybeSendSignupWelcomeEmail } from "@/lib/email/maybe-send-signup-welcome";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const SECRET = "test-hook-secret";

function makeRequest(body: unknown, authorization?: string) {
  return new Request("http://localhost/api/hooks/email-confirmed", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorization ? { authorization } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/hooks/email-confirmed", () => {
  const getUserById = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WELCOME_EMAIL_HOOK_SECRET = SECRET;
    vi.mocked(maybeSendSignupWelcomeEmail).mockResolvedValue(undefined);
    getUserById.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "ada@example.com",
          created_at: "2026-05-28T10:00:00.000Z",
          email_confirmed_at: "2026-05-28T10:05:00.000Z",
          user_metadata: { full_name: "Ada Lovelace" },
        },
      },
      error: null,
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      auth: { admin: { getUserById } },
    } as never);
  });

  afterEach(() => {
    delete process.env.WELCOME_EMAIL_HOOK_SECRET;
  });

  it("returns 500 when the hook secret is not configured", async () => {
    delete process.env.WELCOME_EMAIL_HOOK_SECRET;

    const response = await POST(makeRequest({ userId: "user-1" }, "Bearer anything"));

    expect(response.status).toBe(500);
    expect(maybeSendSignupWelcomeEmail).not.toHaveBeenCalled();
  });

  it("rejects a request without the shared secret", async () => {
    const response = await POST(makeRequest({ userId: "user-1" }, "Bearer wrong-secret"));

    expect(response.status).toBe(401);
    expect(maybeSendSignupWelcomeEmail).not.toHaveBeenCalled();
  });

  it("returns 400 when userId is missing", async () => {
    const response = await POST(makeRequest({}, `Bearer ${SECRET}`));

    expect(response.status).toBe(400);
    expect(maybeSendSignupWelcomeEmail).not.toHaveBeenCalled();
  });

  it("queues a trusted welcome email for a confirmed user", async () => {
    const response = await POST(makeRequest({ userId: "user-1" }, `Bearer ${SECRET}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(maybeSendSignupWelcomeEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        email: "ada@example.com",
        displayName: "Ada Lovelace",
        emailConfirmedAt: "2026-05-28T10:05:00.000Z",
        trustedConfirmation: true,
      }),
    );
  });

  it("accepts a raw Supabase webhook payload ({ record: { id } })", async () => {
    const response = await POST(makeRequest({ record: { id: "user-1" } }, `Bearer ${SECRET}`));

    expect(response.status).toBe(200);
    expect(getUserById).toHaveBeenCalledWith("user-1");
  });

  it("skips a user whose email is not yet confirmed", async () => {
    getUserById.mockResolvedValue({
      data: { user: { id: "user-1", email_confirmed_at: null } },
      error: null,
    });

    const response = await POST(makeRequest({ userId: "user-1" }, `Bearer ${SECRET}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, skipped: "not-confirmed" });
    expect(maybeSendSignupWelcomeEmail).not.toHaveBeenCalled();
  });

  it("returns ok (no retry) when the user cannot be found", async () => {
    getUserById.mockResolvedValue({ data: { user: null }, error: { message: "not found" } });

    const response = await POST(makeRequest({ userId: "ghost" }, `Bearer ${SECRET}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, skipped: "user-not-found" });
    expect(maybeSendSignupWelcomeEmail).not.toHaveBeenCalled();
  });
});
