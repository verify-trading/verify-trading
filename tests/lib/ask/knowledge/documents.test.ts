import { describe, expect, it } from "vitest";

import {
  entityToKnowledgeDocument,
  expandEntityAliases,
  ruleToKnowledgeDocument,
} from "@/lib/ask/knowledge/documents";
import type { VerifiedEntity } from "@/lib/ask/entities";

const ftmo: VerifiedEntity = {
  id: "ftmo",
  name: "FTMO",
  type: "propfirm",
  status: "legitimate",
  fcaRegistered: false,
  fcaReference: null,
  fcaWarning: false,
  trustScore: 8.5,
  notes: "Established prop firm with a consistent payout record.",
  source: "manual-review",
  aliases: ["ftmo.com"],
};

describe("expandEntityAliases", () => {
  it("normalizes the name and merges existing aliases", () => {
    const aliases = expandEntityAliases("The Funded Trader", ["TFT"]);

    expect(aliases).toContain("the funded trader");
    expect(aliases).toContain("funded trader");
    expect(aliases).toContain("thefundedtrader");
    expect(aliases).toContain("tft");
  });

  it("splits letter-digit boundaries for names like FTMO5", () => {
    const aliases = expandEntityAliases("Trader5");

    expect(aliases).toContain("trader 5");
    expect(aliases).toContain("trader5");
  });
});

describe("entityToKnowledgeDocument", () => {
  it("renders a retrievable document with tags and aliases", () => {
    const doc = entityToKnowledgeDocument(ftmo);

    expect(doc.kind).toBe("entity");
    expect(doc.title).toBe("FTMO");
    expect(doc.content).toContain("prop firm");
    expect(doc.content).toContain("8.5/10");
    expect(doc.content).toContain(ftmo.notes);
    expect(doc.tags).toMatchObject({ entity_type: "propfirm", status: "legitimate" });
    expect(doc.aliases).toContain("ftmo");
    expect(doc.sourceTable).toBe("verified_entities");
    expect(doc.sourceId).toBe("ftmo");
  });

  it("includes FCA context for brokers", () => {
    const doc = entityToKnowledgeDocument({
      ...ftmo,
      id: "pepperstone",
      name: "Pepperstone",
      type: "broker",
      fcaRegistered: true,
      fcaReference: "684312",
    });

    expect(doc.content).toContain("FCA registered: yes (FRN 684312)");
  });
});

describe("ruleToKnowledgeDocument", () => {
  it("renders a rule document keyed by rule number", () => {
    const doc = ruleToKnowledgeDocument({
      ruleNumber: 3,
      category: "ENTRY",
      ruleName: "Stop Placement",
      content: "Stops go beyond the manipulation extreme.",
      priority: 2,
      active: true,
    });

    expect(doc.kind).toBe("rule");
    expect(doc.title).toBe("Rule 3: Stop Placement");
    expect(doc.tags).toMatchObject({ category: "ENTRY", rule_number: 3 });
    expect(doc.sourceId).toBe("3");
  });
});
