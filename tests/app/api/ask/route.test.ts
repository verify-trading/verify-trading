import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ask/service", () => ({
  generateAskResponse: vi.fn(),
}));

vi.mock("@/lib/ask/persistence", () => ({
  getAskPersistence: vi.fn(),
}));

import { POST } from "@/app/api/ask/route";
import { fallbackInsightCard } from "@/lib/ask/contracts";
import { getAskPersistence } from "@/lib/ask/persistence";
import { defaultAskImagePrompt } from "@/lib/ask/prompt";
import { generateAskResponse } from "@/lib/ask/service";

async function readResponseJson(response: Response) {
  return await response.json();
}

describe("POST /api/ask", () => {
  const listSessions = vi.fn();
  const loadHistory = vi.fn();
  const loadThreadPage = vi.fn();
  const saveExchange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAskPersistence).mockReturnValue({
      listSessions,
      deleteSession: vi.fn(),
      loadHistory,
      loadThreadPage,
      saveExchange,
    });
    loadHistory.mockResolvedValue([]);
    loadThreadPage.mockResolvedValue({ messages: [], nextCursor: null });
    saveExchange.mockResolvedValue(undefined);
  });

  it("returns a generated card response", async () => {
    vi.mocked(generateAskResponse).mockResolvedValue({
      data: fallbackInsightCard,
      uiMeta: {
        marketSeries: [1, 2, 3],
      },
      sessionId: crypto.randomUUID(),
      messageId: crypto.randomUUID(),
    });

    const response = await POST(
      new Request("http://localhost/api/ask", {
        method: "POST",
        body: JSON.stringify({
          message: "Why am I overtrading?",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const body = await response.text();
    expect(body).toContain('"type":"text-delta"');
    expect(body).toContain("Try Again");
    expect(body).toContain('"type":"data-ui-meta"');
    expect(loadHistory).toHaveBeenCalledTimes(1);
    expect(saveExchange).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for an invalid request body", async () => {
    const response = await POST(
      new Request("http://localhost/api/ask", {
        method: "POST",
        body: JSON.stringify({
          message: "",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(400);
    await expect(readResponseJson(response)).resolves.toEqual({
      error: "invalid_request",
      message: "The Ask request body is invalid.",
    });
  });

  it("returns 400 when the request body is not valid JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/ask", {
        method: "POST",
        body: "{broken",
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(400);
    await expect(readResponseJson(response)).resolves.toEqual({
      error: "invalid_request",
      message: "The Ask request body is invalid.",
    });
  });

  it("uses persisted history when it exists", async () => {
    loadHistory.mockResolvedValue([
      { role: "user", content: "Previous question" },
      { role: "assistant", content: JSON.stringify(fallbackInsightCard) },
    ]);
    vi.mocked(generateAskResponse).mockResolvedValue({
      data: fallbackInsightCard,
      sessionId: crypto.randomUUID(),
      messageId: crypto.randomUUID(),
    });

    await POST(
      new Request("http://localhost/api/ask", {
        method: "POST",
        body: JSON.stringify({
          message: "Follow-up question",
          history: [{ role: "user", content: "Local fallback history" }],
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    expect(generateAskResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        history: [
          { role: "user", content: "Previous question" },
          { role: "assistant", content: JSON.stringify(fallbackInsightCard) },
        ],
      }),
    );
  });

  it("uses request history when persisted history loading fails", async () => {
    loadHistory.mockRejectedValue(new Error("db unavailable"));
    vi.mocked(generateAskResponse).mockResolvedValue({
      data: fallbackInsightCard,
      sessionId: crypto.randomUUID(),
      messageId: crypto.randomUUID(),
    });

    const response = await POST(
      new Request("http://localhost/api/ask", {
        method: "POST",
        body: JSON.stringify({
          message: "Follow-up question",
          history: [{ role: "user", content: "Local fallback history" }],
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(generateAskResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        history: [{ role: "user", content: "Local fallback history" }],
      }),
    );
  });

  it("still streams a response when persistence save fails", async () => {
    saveExchange.mockRejectedValue(new Error("write failed"));
    vi.mocked(generateAskResponse).mockResolvedValue({
      data: fallbackInsightCard,
      sessionId: crypto.randomUUID(),
      messageId: crypto.randomUUID(),
    });

    const response = await POST(
      new Request("http://localhost/api/ask", {
        method: "POST",
        body: JSON.stringify({
          message: "Persist this",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(saveExchange).toHaveBeenCalledTimes(1);
  });

  it("uses the default image prompt internally without persisting it as the user message", async () => {
    vi.mocked(generateAskResponse).mockResolvedValue({
      data: fallbackInsightCard,
      sessionId: crypto.randomUUID(),
      messageId: crypto.randomUUID(),
    });

    const response = await POST(
      new Request("http://localhost/api/ask", {
        method: "POST",
        body: JSON.stringify({
          message: "",
          image: "data:image/png;base64,Zm9v",
          attachmentMeta: {
            fileName: "chart.png",
            mimeType: "image/png",
            size: 512,
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(generateAskResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        message: defaultAskImagePrompt,
      }),
    );
    expect(saveExchange).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage: "",
      }),
    );
  });

  it("returns 502 when the service throws", async () => {
    vi.mocked(generateAskResponse).mockRejectedValue(new Error("boom"));

    const response = await POST(
      new Request("http://localhost/api/ask", {
        method: "POST",
        body: JSON.stringify({
          message: "Break it",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(502);
    await expect(readResponseJson(response)).resolves.toEqual({
      error: "ask_failed",
      message: "Could not generate an Ask response right now.",
    });
  });
});
