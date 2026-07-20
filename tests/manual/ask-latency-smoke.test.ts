/**
 * Manual latency smoke for the short-circuit + cache fixes. Makes REAL
 * Anthropic + Supabase calls, so it is opt-in:
 *
 *   RUN_ASK_SMOKE=1 npx vitest run tests/manual/ask-latency-smoke.test.ts
 *
 * Deterministic calc/projection prompts should finish in ONE model step
 * (timeline shows the calc tool but NO submit_ask_card); verification and
 * briefing prompts must still run their full two-step synthesis.
 */
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, it } from "vitest";

import { generateAskResponse } from "@/lib/ask/pipeline";

// @next/env skips .env.local when NODE_ENV=test (which vitest sets), so the real
// API keys never load through the normal path. Parse .env.local directly.
function loadDotEnvLocal() {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match) continue;
      const [, key, value] = match;
      if (!process.env[key]) {
        process.env[key] = value.trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // no .env.local — rely on whatever is already in the environment
  }
}
loadDotEnvLocal();

const RUN = process.env.RUN_ASK_SMOKE === "1";

const QUERIES: Array<{ q: string; expect: string }> = [
  {
    q: "Position size: 1% risk, £8k, 22 pip stop",
    expect: "SHORT-CIRCUIT: calc card in one step, no submit_ask_card (baseline was 10.8s / 2 steps)",
  },
  {
    q: "risk reward if entry 2650 stop 2638 target 2674",
    expect: "SHORT-CIRCUIT: risk-reward insight in one step",
  },
  {
    q: "project 5k growing 4% a month for 12 months",
    expect: "SHORT-CIRCUIT: projection card in one step",
  },
  {
    q: "is pepperstone safe for uk traders",
    expect: "CONTROL: verify_entity + submit_ask_card (two steps), broker card 8.9 intact",
  },
  {
    q: "whats gold doing today",
    expect: "CONTROL: get_market_briefing + submit_ask_card or tool briefing — market tools not short-circuited",
  },
  {
    q: "thanks man",
    expect: "CONTROL: acknowledgement insight, unchanged path",
  },
];

describe.skipIf(!RUN)("Ask latency smoke", () => {
  for (const { q, expect } of QUERIES) {
    it(
      q,
      async () => {
        const timeline: string[] = [];
        const start = Date.now();
        const at = () => `+${Date.now() - start}ms`;
        let card: unknown = null;
        let followups: unknown = null;
        let error: string | null = null;
        try {
          const res = await generateAskResponse(
            { message: q },
            {},
            { onToolCall: ({ toolName }) => timeline.push(`${toolName} ${at()}`) },
          );
          card = res.data;
          followups = res.uiMeta?.followups ?? [];
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        }
        const ms = Date.now() - start;
        const block = `\n———————————————————————————————————————————————\nQ: ${q}  (TOTAL ${ms}ms)\nexpect: ${expect}\ntimeline: ${timeline.join(" | ")} | done ${at()}\n${
          error
            ? `ERROR: ${error}`
            : `card: ${JSON.stringify(card, null, 2)}\nfollowups: ${JSON.stringify(followups)}`
        }`;
        console.log(block);
        if (process.env.ASK_SMOKE_OUT) appendFileSync(process.env.ASK_SMOKE_OUT, block + "\n");
      },
      120_000,
    );
  }
});
