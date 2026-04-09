import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(),
}));

import { updateSession } from "@/lib/supabase/middleware";
import { middleware } from "../middleware";

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated protected ask routes to login with next", async () => {
    vi.mocked(updateSession).mockResolvedValue({
      response: NextResponse.next(),
      user: null,
    });

    const response = await middleware(new NextRequest("http://localhost/ask?tab=1"));

    expect(response.headers.get("location")).toBe(
      "http://localhost/login?next=%2Fask%3Ftab%3D1",
    );
  });

  it("redirects unauthenticated /ask to login with next (including query)", async () => {
    vi.mocked(updateSession).mockResolvedValue({
      response: NextResponse.next(),
      user: null,
    });

    const response = await middleware(
      new NextRequest("http://localhost/ask?session=sess-1"),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost/login?next=%2Fask%3Fsession%3Dsess-1",
    );
  });

  it("redirects signed-in users away from auth pages", async () => {
    vi.mocked(updateSession).mockResolvedValue({
      response: NextResponse.next(),
      user: { id: "user-1" } as never,
    });

    const response = await middleware(new NextRequest("http://localhost/login?next=%2Fmarkets"));

    expect(response.headers.get("location")).toBe("http://localhost/ask");
  });

  it("returns the refreshed response for public routes", async () => {
    const baseResponse = NextResponse.next();
    vi.mocked(updateSession).mockResolvedValue({
      response: baseResponse,
      user: null,
    });

    const response = await middleware(new NextRequest("http://localhost/"));

    expect(response).toBe(baseResponse);
  });

  it("redirects signed-out users from /markets to login with next", async () => {
    vi.mocked(updateSession).mockResolvedValue({
      response: NextResponse.next(),
      user: null,
    });

    const response = await middleware(new NextRequest("http://localhost/markets"));

    expect(response.headers.get("location")).toBe("http://localhost/login?next=%2Fmarkets");
  });
});
