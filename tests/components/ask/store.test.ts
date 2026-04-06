import { beforeEach, describe, expect, it } from "vitest";

import { mapPersistedMessageToStoreMessage, useAskStore } from "@/components/ask/store";

describe("useAskStore historyWindow", () => {
  beforeEach(() => {
    useAskStore.setState({
      draft: "",
      sessionId: null,
      attachment: null,
      messages: [],
      historyCursor: null,
      isLoadingHistory: false,
      isLoadingOlder: false,
      error: null,
    });
  });

  it("keeps only the most recent six messages for model context", () => {
    const state = useAskStore.getState();

    for (let index = 0; index < 8; index += 1) {
      state.appendUserMessage(`User message ${index}`, null);
    }

    expect(useAskStore.getState().historyWindow()).toHaveLength(6);
    expect(useAskStore.getState().historyWindow()[0]?.content).toContain("User message 2");
  });

  it("compresses assistant projection cards before sending them back into context", () => {
    useAskStore.getState().appendAssistantCard({
      type: "projection",
      months: 12,
      startBalance: 10_000,
      monthlyAdd: 500,
      projectedBalance: 18_750,
      dataPoints: [1, 2, 3, 4, 5, 6],
      totalReturn: "25%",
      lossEvents: 1,
      verdict: "Stay realistic.",
    });

    const history = useAskStore.getState().historyWindow();
    expect(history).toHaveLength(1);
    expect(history[0]?.content).toContain("\"projectedBalance\":18750");
    expect(history[0]?.content).not.toContain("dataPoints");
  });

  it("does not include empty image-only user placeholders in model context", () => {
    const state = useAskStore.getState();

    state.appendUserMessage("", "chart.png", "data:image/png;base64,Zm9v");
    state.appendAssistantCard({
      type: "chart",
      pattern: "Range",
      bias: "Neutral",
      entry: "21,880",
      stop: "21,370",
      target: "21,950",
      rr: "1.4:1",
      confidence: "Medium",
      verdict: "Wait for confirmation.",
    });

    const history = useAskStore.getState().historyWindow();
    expect(history).toHaveLength(1);
    expect(history[0]?.role).toBe("assistant");
  });

  it("drops persisted assistant messages that do not contain a valid card", () => {
    const message = mapPersistedMessageToStoreMessage({
      id: "assistant-1",
      role: "assistant",
      content: "not-json",
      card: null,
      uiMeta: null,
      attachmentMeta: null,
      createdAt: new Date().toISOString(),
    });

    expect(message).toBeNull();
  });
});
