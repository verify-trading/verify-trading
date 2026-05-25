import { describe, expect, it } from "vitest";

import { buildUpdatedSessionMemory } from "@/lib/ask/session-memory";

describe("buildUpdatedSessionMemory", () => {
  it("caps recent user goals when merging new and previous memory", () => {
    const memory = buildUpdatedSessionMemory({
      history: [
        { role: "user", content: "Gold levels before London open" },
        {
          role: "assistant",
          content: JSON.stringify({
            type: "insight",
            headline: "Wait",
            body: "Wait for confirmation.",
            verdict: "Do not chase.",
          }),
        },
        { role: "user", content: "EURUSD?" },
        {
          role: "assistant",
          content: JSON.stringify({
            type: "insight",
            headline: "Watch Euro",
            body: "Euro is near resistance.",
            verdict: "Wait for a clean break.",
          }),
        },
      ],
      userMessage: "I have lost purpose in life",
      assistantCard: {
        type: "insight",
        headline: "Outside My Lane",
        body: "Talk to someone who can actually help.",
        verdict: "Reach out to someone today.",
      },
      previousMemory: {
        recentUserGoals: ["Should I buy gold?", "Check Pepperstone"],
      },
    });

    expect(memory?.recentUserGoals).toHaveLength(3);
    expect(memory?.recentUserGoals).toEqual([
      "I have lost purpose in life",
      "EURUSD?",
      "Gold levels before London open",
    ]);
  });
});
