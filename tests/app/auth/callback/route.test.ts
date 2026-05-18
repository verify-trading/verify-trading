import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { GET } from "@/app/auth/callback/route";
import {
  AUTH_REDIRECT_COOKIE_NAME,
  OAUTH_FLOW_COOKIE_NAME,
  RECENT_OAUTH_SIGNUP_COOKIE_NAME,
} from "@/lib/auth/oauth-flow";
import { createSupabaseServerClient } from "@/lib/supabase/server";

describe("GET /auth/callback", () => {
  const exchangeCodeForSession = vi.fn();
  const signOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          created_at: new Date(Date.now() - 30_000).toISOString(),
          identities: [{ provider: "google" }],
        },
      },
      error: null,
    });
    signOut.mockResolvedValue({ error: null });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        exchangeCodeForSession,
        signOut,
      },
    } as never);
  });

  it("redirects to login when the auth code is missing", async () => {
    const response = await GET(
      new Request("http://localhost/auth/callback", {
        headers: {
          cookie: `${OAUTH_FLOW_COOKIE_NAME}=login_only`,
        },
      }),
    );

    expect(response.headers.get("location")).toBe("http://localhost/login?error=auth_code");
    expect(response.cookies.get(OAUTH_FLOW_COOKIE_NAME)?.value).toBe("");
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("allows Google OAuth from the login page to create a first-time account", async () => {
    const response = await GET(
      new Request("http://localhost/auth/callback?code=test-code&next=%2Fmarkets", {
        headers: {
          cookie: `${OAUTH_FLOW_COOKIE_NAME}=login_only`,
        },
      }),
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith("test-code");
    expect(signOut).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://localhost/markets");
  });

  it("allows an immediate re-login after the same browser just completed signup", async () => {
    const response = await GET(
      new Request("http://localhost/auth/callback?code=test-code&next=%2Fmarkets", {
        headers: {
          cookie: `${OAUTH_FLOW_COOKIE_NAME}=login_only; ${RECENT_OAUTH_SIGNUP_COOKIE_NAME}=user-1`,
        },
      }),
    );

    expect(signOut).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://localhost/markets");
    expect(response.cookies.get(OAUTH_FLOW_COOKIE_NAME)?.value).toBe("");
  });

  it("stores a short-lived recent-signup cookie after signup flow succeeds", async () => {
    const response = await GET(
      new Request("http://localhost/auth/callback?code=test-code&next=%2Fask", {
        headers: {
          cookie: `${OAUTH_FLOW_COOKIE_NAME}=signup`,
        },
      }),
    );

    expect(signOut).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://localhost/ask");
    expect(response.cookies.get(RECENT_OAUTH_SIGNUP_COOKIE_NAME)?.value).toBe("user-1");
  });

  it("uses auth redirect cookie when next is missing from the callback URL", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: "user-old",
          created_at: "2025-01-01T00:00:00.000Z",
          identities: [{ provider: "google" }],
        },
      },
      error: null,
    });

    const response = await GET(
      new Request("http://localhost/auth/callback?code=test-code", {
        headers: {
          cookie: `${AUTH_REDIRECT_COOKIE_NAME}=${encodeURIComponent("/guide")}`,
        },
      }),
    );

    expect(response.headers.get("location")).toBe("http://localhost/guide");
    expect(response.cookies.get(AUTH_REDIRECT_COOKIE_NAME)?.value).toBe("");
  });

  it("falls back to /ask for unsafe next params", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: "user-2",
          created_at: "2025-01-01T00:00:00.000Z",
          identities: [{ provider: "google" }],
        },
      },
      error: null,
    });

    const response = await GET(
      new Request("http://localhost/auth/callback?code=test-code&next=https%3A%2F%2Fevil.com"),
    );

    expect(response.headers.get("location")).toBe("http://localhost/ask");
  });
});
