import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import {
  ANALYSIS_RULES_PROMPT_HEADER,
  buildAnalysisRulesPrompt,
  getActiveAnalysisRules,
} from "@/lib/ask/analysis-rules";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

describe("analysis rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds the exact chart-analysis prompt block in rule order", () => {
    const prompt = buildAnalysisRulesPrompt([
      {
        ruleNumber: 1,
        category: "FOUNDATION",
        ruleName: "Top Down Analysis",
        content: "Monthly, weekly, then daily.",
        priority: 3,
        active: true,
      },
      {
        ruleNumber: 2,
        category: "ENTRY",
        ruleName: "Stop Loss Placement",
        content: "Stops go beyond the extreme.",
        priority: 12,
        active: true,
      },
    ]);

    expect(prompt?.startsWith(ANALYSIS_RULES_PROMPT_HEADER)).toBe(true);
    expect(prompt?.indexOf("Rule 1 | FOUNDATION | Top Down Analysis | Priority 3")).toBeLessThan(
      prompt?.indexOf("Rule 2 | ENTRY | Stop Loss Placement | Priority 12") ?? -1,
    );
  });

  it("returns an empty list when supabase admin is unavailable", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(null);

    await expect(getActiveAnalysisRules()).resolves.toEqual([]);
  });

  it("queries only active rules ordered by rule number", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          rule_number: 1,
          category: "FOUNDATION",
          rule_name: "Top Down Analysis",
          content: "Monthly, weekly, then daily.",
          priority: 3,
          active: true,
        },
      ],
      error: null,
    });
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from,
    } as never);

    const rules = await getActiveAnalysisRules();

    expect(from).toHaveBeenCalledWith("analysis_rules");
    expect(select).toHaveBeenCalledWith(
      "rule_number, category, rule_name, content, priority, active",
    );
    expect(eq).toHaveBeenCalledWith("active", true);
    expect(order).toHaveBeenCalledWith("rule_number", { ascending: true });
    expect(rules).toEqual([
      {
        ruleNumber: 1,
        category: "FOUNDATION",
        ruleName: "Top Down Analysis",
        content: "Monthly, weekly, then daily.",
        priority: 3,
        active: true,
      },
    ]);
  });
});
