import { generateObject } from "ai";
import { z } from "zod";

import { getAskSimpleModel } from "@/lib/ask/service/provider";
import { fetchPublicUrl } from "@/lib/http/safe-fetch";

export const challengeConfigSchema = z.object({
  firmUrl: z.url(),
  accountSize: z.number().finite().positive().max(100_000_000),
  accountType: z.enum(["2step", "1step", "instant"]),
});

const challengeRulesSchema = z.object({
  firm_name: z.string().min(1),
  daily_loss_limit: z.string().min(1),
  max_drawdown: z.string().min(1),
  profit_target: z.string().min(1),
  min_trading_days: z.number().nullable(),
  max_trading_days: z.number().nullable(),
  weekend_holding: z.boolean(),
  news_trading_allowed: z.boolean(),
  other_rules: z.array(z.string()),
});

export type ChallengeRules = z.infer<typeof challengeRulesSchema>;

export type ChallengeConfigRow = {
  id: string;
  firm_name: string;
  firm_url: string;
  account_size: number | string;
  account_type: "2step" | "1step" | "instant";
  rules: ChallengeRules;
  created_at: string;
  updated_at: string;
};

export function toChallengeConfig(row: ChallengeConfigRow) {
  return {
    id: row.id,
    firmName: row.firm_name,
    firmUrl: row.firm_url,
    accountSize: Number(row.account_size),
    accountType: row.account_type,
    rules: row.rules,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function extractChallengeRules(input: z.infer<typeof challengeConfigSchema>) {
  // SSRF guard: only fetch public http(s) hosts, with a timeout (see fetchPublicUrl).
  const pageText = await fetchPublicUrl(input.firmUrl)
    .then((response) => response.text())
    .then((html) => html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").slice(0, 20_000));

  const result = await generateObject({
    model: getAskSimpleModel(),
    schema: challengeRulesSchema,
    prompt: `Extract prop firm challenge rules from this page text.
Account type: ${input.accountType}
Account size: ${input.accountSize}
Return only the requested fields.

${pageText}`,
  });

  return result.object;
}
