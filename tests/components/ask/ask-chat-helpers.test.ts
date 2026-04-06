// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import {
  type AskChatMessage,
  extractAssistantCard,
  extractSessionData,
  extractUiMeta,
  fetchHistoryPage,
} from "@/components/ask/ask-chat-helpers";
import { fallbackInsightCard } from "@/lib/ask/contracts";

describe("ask chat helpers", () => {
  it("returns null when an assistant message does not contain a valid card payload", () => {
    const card = extractAssistantCard({
      id: "assistant-1",
      role: "assistant",
      parts: [{ type: "text", text: "not json" }],
    });

    expect(card).toBeNull();
  });

  it("ignores invalid ui metadata and session metadata", () => {
    const message: AskChatMessage = {
      id: "assistant-1",
      role: "assistant",
      parts: [
        { type: "data-ui-meta", data: { marketSeries: ["bad"] } },
        { type: "data-session", data: { sessionId: "bad" } },
        { type: "text", text: JSON.stringify(fallbackInsightCard) },
      ],
    } as unknown as AskChatMessage;

    expect(extractUiMeta(message)).toBeUndefined();
    expect(extractSessionData(message)).toBeUndefined();
  });

  it("throws when the history endpoint returns an invalid payload", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        messages: [{ bad: true }],
      }),
    }) as unknown as typeof fetch;

    await expect(fetchHistoryPage(crypto.randomUUID())).rejects.toThrow(
      "Failed to load chat history.",
    );
  });

  it("throws when the history endpoint returns a non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: "history_unavailable",
      }),
    }) as unknown as typeof fetch;

    await expect(fetchHistoryPage(crypto.randomUUID())).rejects.toThrow(
      "Failed to load chat history.",
    );
  });
});
