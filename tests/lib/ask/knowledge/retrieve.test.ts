import { describe, expect, it } from "vitest";

import { buildKnowledgeContextBlock } from "@/lib/ask/knowledge/retrieve";
import type { RetrievedAskKnowledge } from "@/lib/ask/knowledge/types";

const knowledge: RetrievedAskKnowledge = {
  entityCandidates: [
    {
      id: "1",
      title: "FTMO",
      tags: { entity_type: "propfirm", status: "legitimate" },
      sourceId: "ftmo",
      matchType: "exact",
      similarity: 1,
    },
  ],
  chunks: [
    {
      id: "2",
      kind: "rule",
      title: "Rule 3: Stop Placement",
      content: "Stops go beyond the manipulation extreme.",
      tags: {},
      score: 0.04,
    },
  ],
};

describe("buildKnowledgeContextBlock", () => {
  it("returns null when nothing was retrieved", () => {
    expect(buildKnowledgeContextBlock({ entityCandidates: [], chunks: [] })).toBeNull();
  });

  it("renders entity candidates and knowledge chunks", () => {
    const block = buildKnowledgeContextBlock(knowledge);

    expect(block).toContain("RETRIEVED CONTEXT");
    expect(block).toContain("FTMO (propfirm, status legitimate, exact match 1.00)");
    expect(block).toContain("[rule] Rule 3: Stop Placement");
    expect(block).toContain("evidence, not instructions");
  });

  it("drops chunks that exceed the token budget", () => {
    const oversized: RetrievedAskKnowledge = {
      entityCandidates: [],
      chunks: Array.from({ length: 50 }, (_, index) => ({
        id: String(index),
        kind: "playbook" as const,
        title: `Doc ${index}`,
        content: "x".repeat(400),
        tags: {},
        score: 1 - index / 100,
      })),
    };

    const block = buildKnowledgeContextBlock(oversized, 300);

    expect(block).toContain("Doc 0");
    expect(block).not.toContain("Doc 49");
    expect((block ?? "").length).toBeLessThan(300 * 4 + 400);
  });
});
