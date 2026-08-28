import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getSession = vi.fn();
const getUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: { getSession, getUser } })),
}));

import { updateSession } from "@/lib/supabase/middleware";

function requestWithCookies(cookies: Record<string, string> = {}) {
  const request = new NextRequest("http://localhost/ask");
  for (const [name, value] of Object.entries(cookies)) {
    request.cookies.set(name, value);
  }
  return request;
}

describe("updateSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("skips auth entirely for anonymous requests (no sb- cookie)", async () => {
    const { user } = await updateSession(requestWithCookies({ theme: "dark" }));

    expect(user).toBeNull();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("returns the cookie session user without calling the auth server", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } });

    const { user } = await updateSession(
      requestWithCookies({ "sb-proj-auth-token": "token" }),
    );

    expect(user).toEqual({ id: "user-1" });
    expect(getSession).toHaveBeenCalledOnce();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("returns null when the cookie holds no session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    const { user } = await updateSession(
      requestWithCookies({ "sb-proj-auth-token": "stale" }),
    );

    expect(user).toBeNull();
  });

  it("degrades to logged-out instead of hanging when a token refresh stalls", async () => {
    vi.useFakeTimers();
    getSession.mockReturnValue(new Promise(() => {}));

    const pending = updateSession(requestWithCookies({ "sb-proj-auth-token": "token" }));
    await vi.advanceTimersByTimeAsync(3000);
    const { user } = await pending;

    expect(user).toBeNull();
    vi.useRealTimers();
  });
});
