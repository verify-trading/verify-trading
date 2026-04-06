import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(() => null),
}));

import { clearMemoryAskPersistence, getAskPersistence } from "@/lib/ask/persistence";

describe("getAskPersistence", () => {
  beforeEach(() => {
    clearMemoryAskPersistence();
  });

  it("stores and reloads exchanges in memory when supabase is unavailable", async () => {
    const persistence = getAskPersistence();
    const sessionId = crypto.randomUUID();

    await persistence.saveExchange({
      sessionId,
      userMessage: "Is FTMO legitimate?",
      assistantCard: {
        type: "broker",
        name: "FTMO",
        score: "9.1",
        status: "LEGITIMATE",
        fca: "No",
        complaints: "Low",
        verdict: "Well established prop firm. Strong payout reputation.",
        color: "green",
      },
      assistantUiMeta: {
        projectionMarkers: [1],
      },
    });

    const history = await persistence.loadHistory(sessionId);
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual({
      role: "user",
      content: "Is FTMO legitimate?",
    });
    expect(history[1]?.role).toBe("assistant");
    expect(history[1]?.content).toContain("\"type\":\"broker\"");

    const page = await persistence.loadThreadPage(sessionId, { limit: 20 });
    expect(page.messages).toHaveLength(2);
    expect(page.messages[1]?.card?.type).toBe("broker");
    expect(page.messages[1]?.uiMeta).toEqual({ projectionMarkers: [1] });
    expect(page.nextCursor).toBeNull();

    const sessionsPage = await persistence.listSessions();
    expect(sessionsPage.sessions).toEqual([
      expect.objectContaining({
        id: sessionId,
        title: "Is FTMO legitimate?",
      }),
    ]);
    expect(sessionsPage.nextCursor).toBeNull();
  });

  it("paginates older memory history without duplicating records", async () => {
    const persistence = getAskPersistence();
    const sessionId = crypto.randomUUID();

    for (let index = 0; index < 12; index += 1) {
      await persistence.saveExchange({
        sessionId,
        userMessage: `Question ${index}`,
        assistantCard: {
          type: "insight",
          headline: `H${index}`,
          body: `Body ${index}`,
          verdict: `Verdict ${index}`,
        },
      });
    }

    const latestPage = await persistence.loadThreadPage(sessionId, { limit: 10 });
    expect(latestPage.messages).toHaveLength(10);
    expect(latestPage.nextCursor).not.toBeNull();

    const olderPage = await persistence.loadThreadPage(sessionId, {
      limit: 10,
      cursor: latestPage.nextCursor,
    });

    expect(olderPage.messages).toHaveLength(10);
    expect(olderPage.messages[0]?.content).toBe("Question 2");
    expect(olderPage.messages.at(-1)?.content).toContain("\"type\":\"insight\"");
  });

  it("uses the attachment name for image-only session titles and keeps the user message blank", async () => {
    const persistence = getAskPersistence();
    const sessionId = crypto.randomUUID();

    await persistence.saveExchange({
      sessionId,
      userMessage: "",
      attachmentMeta: {
        fileName: "nasdaq-chart.png",
        mimeType: "image/png",
        size: 1024,
      },
      assistantCard: {
        type: "chart",
        pattern: "Range",
        bias: "Neutral",
        entry: "21,880",
        stop: "21,370",
        target: "21,950",
        rr: "1.4:1",
        confidence: "Medium",
        verdict: "Wait for confirmation.",
      },
    });

    const page = await persistence.loadThreadPage(sessionId, { limit: 20 });
    expect(page.messages[0]?.role).toBe("user");
    expect(page.messages[0]?.content).toBe("");

    const history = await persistence.loadHistory(sessionId);
    expect(history).toEqual([
      {
        role: "assistant",
        content: expect.stringContaining("\"type\":\"chart\""),
      },
    ]);

    const sessionsPage = await persistence.listSessions();
    expect(sessionsPage.sessions).toEqual([
      expect.objectContaining({
        id: sessionId,
        title: "nasdaq-chart.png",
      }),
    ]);
  });
});
