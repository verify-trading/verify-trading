import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ask/service", () => ({
  generateAskResponse: vi.fn(),
}));

vi.mock("@/lib/ask/persistence", () => ({
  getAskPersistence: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/rate-limit/reserve-ask-query", () => ({
  reserveAskQuery: vi.fn(),
}));

import { POST } from "@/app/api/mobile/ask/route";
import { fallbackInsightCard } from "@/lib/ask/contracts";
import { getAskPersistence } from "@/lib/ask/persistence";
import { generateAskResponse } from "@/lib/ask/service";
import { getSessionUser } from "@/lib/auth/session";
import { FREE_DAILY_ASK_LIMIT } from "@/lib/rate-limit/usage";
import { reserveAskQuery } from "@/lib/rate-limit/reserve-ask-query";

describe("POST /api/mobile/ask", () => {
  const loadHistory = vi.fn();
  const loadSessionMemory = vi.fn();
  const saveExchange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Route plumbing is pipeline-agnostic; pin the mocked legacy pipeline.
    process.env.ASK_PIPELINE = "legacy";
    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "00000000-0000-0000-0000-000000000001" } as never,
      supabase: {} as never,
    });
    vi.mocked(reserveAskQuery).mockResolvedValue({
      ok: true,
      tier: "free",
      remaining: FREE_DAILY_ASK_LIMIT - 1,
    });
    vi.mocked(getAskPersistence).mockReturnValue({
      listSessions: vi.fn(),
      deleteSession: vi.fn(),
      loadHistory,
      loadSessionMemory,
      loadThreadPage: vi.fn(),
      saveExchange,
    });
    loadHistory.mockResolvedValue([]);
    loadSessionMemory.mockResolvedValue(null);
    saveExchange.mockResolvedValue(undefined);
  });

  it("returns the final Ask card as JSON without stream parts", async () => {
    const sessionId = crypto.randomUUID();
    const messageId = crypto.randomUUID();
    vi.mocked(generateAskResponse).mockResolvedValue({
      data: fallbackInsightCard,
      uiMeta: { marketSeries: [1, 2, 3] },
      sessionId,
      messageId,
    });

    const response = await POST(
      new Request("http://localhost/api/mobile/ask", {
        method: "POST",
        body: JSON.stringify({ message: "Why am I overtrading?" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(response.json()).resolves.toEqual({
      data: fallbackInsightCard,
      uiMeta: { marketSeries: [1, 2, 3] },
      sessionId,
      messageId,
    });
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(saveExchange).toHaveBeenCalledTimes(1);
  });
});
