import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/email/maybe-send-signup-welcome", () => ({
  maybeSendSignupWelcomeEmail: vi.fn(),
}));

import { POST } from "@/app/api/auth/signup-welcome/route";
import { getSessionUser } from "@/lib/auth/session";
import { maybeSendSignupWelcomeEmail } from "@/lib/email/maybe-send-signup-welcome";

describe("POST /api/auth/signup-welcome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(maybeSendSignupWelcomeEmail).mockResolvedValue(undefined);
    vi.mocked(getSessionUser).mockResolvedValue({
      user: {
        id: "user-1",
        email: "ada@example.com",
        created_at: "2026-05-28T10:00:00.000Z",
        email_confirmed_at: "2026-05-28T10:05:00.000Z",
        user_metadata: {
          full_name: "Ada Lovelace",
        },
      },
    } as never);
  });

  it("requires a signed-in user", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/auth/signup-welcome", { method: "POST" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "unauthorized",
      message: "Sign in to continue.",
    });
    expect(maybeSendSignupWelcomeEmail).not.toHaveBeenCalled();
  });

  it("queues the signup welcome email for the current native user", async () => {
    const response = await POST(new Request("http://localhost/api/auth/signup-welcome", { method: "POST" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(maybeSendSignupWelcomeEmail).toHaveBeenCalledWith({
      userId: "user-1",
      email: "ada@example.com",
      displayName: "Ada Lovelace",
      createdAt: "2026-05-28T10:00:00.000Z",
      emailConfirmedAt: "2026-05-28T10:05:00.000Z",
      appOrigin: "http://localhost",
    });
  });

  it("does not fail auth completion when welcome email dispatch fails", async () => {
    vi.mocked(maybeSendSignupWelcomeEmail).mockRejectedValue(new Error("resend down"));

    const response = await POST(new Request("http://localhost/api/auth/signup-welcome", { method: "POST" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
