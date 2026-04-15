import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ask/persistence", () => ({
  getAskPersistence: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(),
}));

import { GET } from "@/app/api/ask/sessions/route";
import { getAskPersistence } from "@/lib/ask/persistence";
import { getSessionUser } from "@/lib/auth/session";

describe("GET /api/ask/sessions", () => {
  const listSessions = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "00000000-0000-0000-0000-000000000001" } as never,
      supabase: {} as never,
    });
    vi.mocked(getAskPersistence).mockReturnValue({
      listSessions,
      deleteSession: vi.fn(),
      loadHistory: vi.fn(),
      loadSessionMemory: vi.fn(),
      loadThreadPage: vi.fn(),
      saveExchange: vi.fn(),
    });
    listSessions.mockResolvedValue({ sessions: [], nextCursor: null });
  });

  it("returns saved Ask sessions", async () => {
    listSessions.mockResolvedValue({
      sessions: [
        {
          id: crypto.randomUUID(),
          title: "Gold briefing",
          updatedAt: "2026-04-06T00:00:00.000Z",
        },
      ],
      nextCursor: null,
    });

    const response = await GET(new Request("http://localhost/api/ask/sessions?limit=20"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.sessions).toHaveLength(1);
    expect(json.nextCursor).toBeNull();
    expect(listSessions).toHaveBeenCalledWith(20, null);
  });

  it("passes cursor through to session pagination", async () => {
    const response = await GET(
      new Request("http://localhost/api/ask/sessions?limit=20&cursor=session-cursor"),
    );

    expect(response.status).toBe(200);
    expect(listSessions).toHaveBeenCalledWith(20, "session-cursor");
  });

  it("returns 400 when the query is invalid", async () => {
    const response = await GET(new Request("http://localhost/api/ask/sessions?limit=0"));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({
      error: "sessions_request_invalid",
      message: "The Ask sessions request is invalid.",
    });
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/ask/sessions"));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toEqual({
      error: "unauthorized",
      message: "Sign in to load Ask sessions.",
    });
  });

  it("returns 500 when session loading fails", async () => {
    listSessions.mockRejectedValue(new Error("db down"));

    const response = await GET(new Request("http://localhost/api/ask/sessions"));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({
      error: "sessions_unavailable",
      message: "Could not load Ask sessions right now.",
    });
  });
});
