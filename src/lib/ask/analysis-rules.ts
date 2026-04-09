import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type AnalysisRule = {
  ruleNumber: number;
  category: string;
  ruleName: string;
  content: string;
  priority: number;
  active: boolean;
};

export const ANALYSIS_RULES_PROMPT_HEADER =
  "Apply these exact trading rules when analysing this chart:";

export async function getActiveAnalysisRules(): Promise<AnalysisRule[]> {
  const client = getSupabaseAdminClient();
  if (!client) {
    logger.warn("Analysis rules unavailable because Supabase admin is not configured.");
    return [];
  }

  const { data, error } = await client
    .from("analysis_rules")
    .select("rule_number, category, rule_name, content, priority, active")
    .eq("active", true)
    .order("rule_number", { ascending: true });

  if (error) {
    throw new Error("Could not load analysis rules.");
  }

  return (data ?? []).map((row) => ({
    ruleNumber: Number(row.rule_number),
    category: String(row.category),
    ruleName: String(row.rule_name),
    content: String(row.content),
    priority: Number(row.priority),
    active: Boolean(row.active),
  }));
}

export function buildAnalysisRulesPrompt(rules: AnalysisRule[]): string | null {
  if (rules.length === 0) {
    return null;
  }

  return [
    ANALYSIS_RULES_PROMPT_HEADER,
    "",
    ...rules.map(
      (rule) =>
        `Rule ${rule.ruleNumber} | ${rule.category} | ${rule.ruleName} | Priority ${rule.priority}\n${rule.content}`,
    ),
  ].join("\n\n");
}
