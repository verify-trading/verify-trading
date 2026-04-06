import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ask/persistence", () => ({
  getAskPersistence: vi.fn(),
}));

import { GET } from "@/app/api/ask/history/route";
import { getAskPersistence } from "@/lib/ask/persistence";

describe("GET /api/ask/history", () => {
  const loadThreadPage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAskPersistence).mockReturnValue({
      listSessions: vi.fn(),
      deleteSession: vi.fn(),
      loadHistory: vi.fn(),
      loadThreadPage,
      saveExchange: vi.fn(),
    });
    loadThreadPage.mockResolvedValue({
      messages: [],
      nextCursor: null,
    });
  });

  it("returns a paged message response", async () => {
    loadThreadPage.mockResolvedValue({
      messages: [
        {
          id: "message-1",
          role: "assistant",
          content: "{\"type\":\"insight\"}",
          card: {
            type: "insight",
            headline: "Calm Execution",
            body: "You are trading your emotions, not the setup.",
            verdict: "Stand down for one session.",
          },
          uiMeta: null,
          attachmentMeta: null,
          createdAt: "2026-04-04T00:00:00.000Z",
        },
      ],
      nextCursor: "2026-04-04T00:00:00.000Z",
    });

    const response = await GET(
      new Request(
        `http://localhost/api/ask/history?sessionId=${crypto.randomUUID()}&limit=20`,
      ),
    );

    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.messages).toHaveLength(1);
    expect(json.nextCursor).toBe("2026-04-04T00:00:00.000Z");
    expect(loadThreadPage).toHaveBeenCalledTimes(1);
  });

  it("returns a 400 payload when the query is invalid", async () => {
    const response = await GET(
      new Request("http://localhost/api/ask/history?sessionId=invalid"),
    );

    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json).toEqual({
      error: "history_request_invalid",
      message: "The Ask history request is invalid.",
    });
  });

  it("returns a 400 payload when the cursor is malformed", async () => {
    const response = await GET(
      new Request(
        `http://localhost/api/ask/history?sessionId=${crypto.randomUUID()}&cursor=broken-cursor`,
      ),
    );

    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json).toEqual({
      error: "history_request_invalid",
      message: "The Ask history request is invalid.",
    });
  });

  it("returns 500 when history loading fails", async () => {
    loadThreadPage.mockRejectedValue(new Error("db down"));

    const response = await GET(
      new Request(
        `http://localhost/api/ask/history?sessionId=${crypto.randomUUID()}&limit=20`,
      ),
    );

    const json = await response.json();
    expect(response.status).toBe(500);
    expect(json).toEqual({
      error: "history_unavailable",
      message: "Could not load Ask history right now.",
    });
  });
});
