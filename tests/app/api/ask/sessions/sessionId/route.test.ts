import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ask/persistence", () => ({
  getAskPersistence: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(),
}));

import { DELETE } from "@/app/api/ask/sessions/[sessionId]/route";
import { getAskPersistence } from "@/lib/ask/persistence";
import { getSessionUser } from "@/lib/auth/session";

describe("DELETE /api/ask/sessions/[sessionId]", () => {
  const deleteSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "00000000-0000-0000-0000-000000000001" },
      supabase: {} as never,
    });
    vi.mocked(getAskPersistence).mockReturnValue({
      listSessions: vi.fn(),
      deleteSession,
      loadHistory: vi.fn(),
      loadThreadPage: vi.fn(),
      saveExchange: vi.fn(),
    });
    deleteSession.mockResolvedValue(undefined);
  });

  it("deletes a session by id", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const response = await DELETE(new Request(`http://localhost/api/ask/sessions/${id}`), {
      params: Promise.resolve({ sessionId: id }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true });
    expect(deleteSession).toHaveBeenCalledWith(id);
  });

  it("returns 400 for invalid session id", async () => {
    const response = await DELETE(new Request("http://localhost/api/ask/sessions/not-a-uuid"), {
      params: Promise.resolve({ sessionId: "not-a-uuid" }),
    });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("sessions_delete_invalid");
    expect(deleteSession).not.toHaveBeenCalled();
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);
    const id = "11111111-1111-4111-8111-111111111111";

    const response = await DELETE(new Request(`http://localhost/api/ask/sessions/${id}`), {
      params: Promise.resolve({ sessionId: id }),
    });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toEqual({
      error: "unauthorized",
      message: "Sign in to manage Ask sessions.",
    });
  });

  it("returns 500 when delete fails", async () => {
    deleteSession.mockRejectedValue(new Error("db down"));
    const id = "22222222-2222-4222-8222-222222222222";

    const response = await DELETE(new Request(`http://localhost/api/ask/sessions/${id}`), {
      params: Promise.resolve({ sessionId: id }),
    });
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("sessions_delete_unavailable");
  });
});
