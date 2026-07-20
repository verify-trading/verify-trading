import { describe, it } from "vitest";
import { writeFileSync } from "node:fs";

import { extractChallengeRules } from "@/lib/journal/challenge";

// Maintenance tool (not a real test): regenerates src/lib/journal/firmRulesCache.ts by
// running the live scraper across the top firms. Skipped by default; run it to refresh the
// cache when a firm changes its rules. Keep this list in sync with the mobile picker
// (verify-trading-mobile/src/features/journal/propFirms.ts). Opt-in:
//   set -a; source <(grep -E '^(ANTHROPIC_(API_KEY|MODEL|BASE_URL)|FIRECRAWL_API_KEY)=' .env.local); set +a
//   RUN_SEED=1 npx vitest run _seed --disableConsoleIntercept
const FIRMS: Array<{ name: string; url: string }> = [
  { name: "FTMO", url: "https://ftmo.com" },
  { name: "FundedNext", url: "https://fundednext.com" },
  { name: "The5ers", url: "https://the5ers.com" },
  { name: "FundingPips", url: "https://fundingpips.com" },
  { name: "E8 Markets", url: "https://e8markets.com" },
  { name: "Alpha Capital Group", url: "https://alphacapitalgroup.uk" },
  { name: "Topstep", url: "https://www.topstep.com" },
  { name: "Blue Guardian", url: "https://blueguardian.com" },
  { name: "FunderPro", url: "https://funderpro.com" },
  { name: "Goat Funded Trader", url: "https://goatfundedtrader.com" },
  { name: "Instant Funding", url: "https://instantfunding.com" },
  { name: "The Trading Pit", url: "https://thetradingpit.com" },
  { name: "City Traders Imperium", url: "https://citytradersimperium.com" },
  { name: "Maven Trading", url: "https://maventrading.com" },
  { name: "Funding Traders", url: "https://fundingtraders.com" },
  { name: "Lark Funding", url: "https://larkfunding.com" },
];

const na = (v: unknown) => !v || /^n\/?a$/i.test(String(v).trim());
const domainOf = (u: string) => u.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();

const run = process.env.RUN_SEED ? describe : describe.skip;
run("firm rules seed generator", () => {
  it("scrapes the top firms and writes firmRulesCache.ts", async () => {
    const entries: unknown[] = [];
    for (const firm of FIRMS) {
      try {
        const rules = await extractChallengeRules({ firmUrl: firm.url, accountSize: 100_000, accountType: "2step" });
        const core = [rules.daily_loss_limit, rules.max_drawdown, rules.profit_target].filter((v) => !na(v)).length;
        // eslint-disable-next-line no-console
        console.log(`${firm.name}: core ${core}/3 — ${rules.daily_loss_limit} / ${rules.max_drawdown} / ${rules.profit_target}`);
        if (core >= 2) {
          entries.push({ domain: domainOf(firm.url), firmName: rules.firm_name, firmUrl: firm.url, accountSize: 100_000, accountType: "2step", rules });
        } else {
          // eslint-disable-next-line no-console
          console.log(`  ↳ skipped (weak scrape — will live-scrape on demand)`);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.log(`${firm.name}: ERROR ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const file =
      `// AUTO-GENERATED — do not edit by hand. Regenerate with tests/lib/journal/_seed.test.ts.\n` +
      `// Top prop firms' challenge rules, captured by the live scraper at $100k / 2-step so the\n` +
      `// common firms resolve instantly instead of live-scraping on every setup.\n` +
      `import type { AccountType, ChallengeRules } from "./challenge";\n\n` +
      `export type FirmRulesSeed = { domain: string; firmName: string; firmUrl: string; accountSize: number; accountType: AccountType; rules: ChallengeRules };\n\n` +
      `export const FIRM_RULES_SEED: FirmRulesSeed[] = ${JSON.stringify(entries, null, 2)};\n`;
    writeFileSync(new URL("../../../src/lib/journal/firmRulesCache.ts", import.meta.url), file);
    // eslint-disable-next-line no-console
    console.log(`\n✅ wrote ${entries.length}/${FIRMS.length} firms to src/lib/journal/firmRulesCache.ts`);
  }, 900_000);
});
