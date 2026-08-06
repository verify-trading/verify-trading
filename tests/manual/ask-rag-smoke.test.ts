/**
 * Manual end-to-end smoke test for the Ask RAG flow. Makes REAL Anthropic +
 * Supabase calls, so it is opt-in:
 *
 *   RUN_ASK_SMOKE=1 npx vitest run tests/manual/ask-rag-smoke.test.ts
 *
 * It runs a spread of human-style queries (rushed / mistyped / professional)
 * through generateAskResponse and prints the final card + tool calls so
 * the answers can be validated against the BTS/entity ground truth.
 */
import { appendFileSync } from "node:fs";

import { describe, it } from "vitest";

import { generateAskResponse } from "@/lib/ask/pipeline";

import { loadDotEnvLocal } from "./env-local";

loadDotEnvLocal();

const RUN = process.env.RUN_ASK_SMOKE === "1";

type Turn = { role: "user" | "assistant"; content: string };
type SmokeQuery = { q: string; expect: string; history?: Turn[] };
const PROPFIRM_QUERIES: SmokeQuery[] = [
  { q: "tell me the top pop firms", expect: "typo for prop firms -> RAG grounds in DB prop firms + followups" },
  { q: "is FTMO worth it", expect: "FTMO -> legit prop firm, payout framing" },
  { q: "best prop firm for fast payouts", expect: "grounded list, not invented" },
  { q: "is the funded trader legit", expect: "DB warning -> payout-denial caution" },
  { q: "propfirm recommendations for a uk trader", expect: "grounded, not FCA framing" },
];

const FTMO_HISTORY: Turn[] = [
  { role: "user", content: "is FTMO legit" },
  { role: "assistant", content: '{"type":"broker","name":"FTMO","score":"9.1","status":"LEGITIMATE","fca":"No","complaints":"Low","verdict":"Top prop firm globally, consistent payouts."}' },
];
const PROPFIRM_HISTORY: Turn[] = [
  { role: "user", content: "tell me the top prop firms" },
  { role: "assistant", content: '{"type":"insight","headline":"Top Prop Firms","body":"FTMO 9.1, The5ers 8.6.","verdict":"Start with FTMO."}' },
];

// Confusing / tough conversational follow-ups — the cases that produced "the mess".
const TOUGH_QUERIES: SmokeQuery[] = [
  { q: "how long is the challenge?", history: FTMO_HISTORY, expect: "ANSWER the FTMO challenge duration (insight), NOT the trust card" },
  { q: "whats their fee", history: FTMO_HISTORY, expect: "ANSWER FTMO fee (insight), NOT the trust card" },
  { q: "is it safe though?", history: FTMO_HISTORY, expect: "trust check on 'it' = FTMO -> broker card 9.1" },
  { q: "compare ftmo and the5ers for payouts", expect: "grounded comparison of both" },
  { q: "and pepperstone for uk traders?", history: PROPFIRM_HISTORY, expect: "topic switch to a broker -> verify pepperstone" },
];

// Broad spread of real user phrasings across every answer type.
const DIVERSE_QUERIES: SmokeQuery[] = [
  { q: "is pepperstone safe for uk traders", expect: "broker, FCA-confirmed" },
  { q: "ftmo or the5ers which is better", expect: "prop comparison, both verified" },
  { q: "is jafx a scam", expect: "broker check, avoid/unknown handled honestly" },
  { q: "whats nasdaq doing today", expect: "live briefing card" },
  { q: "should i buy bitcoin here", expect: "makes a call, not a description" },
  { q: "position size for 1% risk on a 10k account with a 20 pip stop", expect: "calc card with lots" },
  { q: "best brokers for uk traders", expect: "list_verified_entities, ranked" },
  { q: "how do i know when to enter a trade", expect: "method insight, actionable" },
  { q: "is ict legit", expect: "guru check or honest no-record" },
  { q: "set up a long on eurusd", expect: "setup card with entry/stop/target" },
];

const QUERIES: SmokeQuery[] = [
  // Repetition probe: four unregulated/avoid brokers in a row — verdicts must NOT
  // all read "not FCA authorised, no FSCS, no ombudsman, do not deposit".
  { q: "is olymp trade safe", expect: "avoid — distinct phrasing" },
  { q: "aafx good for uk traders?", expect: "avoid — distinct phrasing" },
  { q: "4xcube legit", expect: "avoid — distinct phrasing" },
  { q: "thoughts on 99fx", expect: "avoid — distinct phrasing" },
  // Prop firms — payout/challenge framing, not FCA, distinct from each other.
  { q: "is FTMO legit", expect: "prop firm, legit, payout framing" },
  { q: "the funded trader any good", expect: "prop firm, warning, distinct" },
  // Provisional + founder-locked + guru.
  { q: "anzo capital good broker??", expect: "provisional, offshore downgrade" },
  { q: "what about acetop financial", expect: "founder note, Proceed With Caution" },
  { q: "amir trader legit guru?", expect: "guru, avoid" },
  // Method questions phrased two ways — answers should differ, not boilerplate.
  { q: "where do I put my stop loss", expect: "method, natural" },
  { q: "how big should my stop be on gold", expect: "method, different angle from above" },
  // Market + multi-turn follow-up (history) — must use context, not repeat.
  { q: "whats gold doing today", expect: "briefing, live price" },
  {
    q: "should I buy it here?",
    history: [
      { role: "user", content: "whats gold doing today" },
      { role: "assistant", content: '{"type":"briefing","asset":"GOLD","price":"4361.80","verdict":"Gold broke above the range high."}' },
    ],
    expect: "uses gold context from history, makes a call",
  },
  // Conversational follow-up after a tool call — must still submit_ask_card + followups.
  {
    q: "ohh i see so fmto is what?",
    history: [
      { role: "user", content: "tell me the top prop firms" },
      { role: "assistant", content: '{"type":"insight","headline":"Top Prop Firms Ranked","body":"FTMO leads at 9.1, The5ers 8.6.","verdict":"Start with FTMO."}' },
    ],
    expect: "FTMO answer via submit_ask_card WITH followups, not a raw tool card",
  },
  // Product question about a firm already shown — must ANSWER it, not re-show the trust card.
  {
    q: "how long is the challenge?",
    history: [
      { role: "user", content: "is FTMO legit" },
      { role: "assistant", content: '{"type":"broker","name":"FTMO","score":"9.1","status":"LEGITIMATE","fca":"No","complaints":"Low","verdict":"Top prop firm globally."}' },
    ],
    expect: "insight answering FTMO challenge duration, NOT the broker trust card again",
  },
  // Acknowledgement + out of scope.
  { q: "thanks man", expect: "short friendly close, not a card dump" },
  { q: "whats a good pasta recipe", expect: "out of scope" },
];

// Small 5-query spread for a quick "how does it answer" check.
const LIVE_QUERIES: SmokeQuery[] = [
  { q: "is Alpha Futures safe", expect: "developing Alpha Futures record; cited evidence, no final score" },
  { q: "is Alpha Capital Group safe", expect: "separate Alpha Capital Group record; never Alpha Futures" },
  { q: "is alfha futures safe", expect: "typo resolves only to Alpha Futures, never Alpha Capital Group" },
  { q: "ceniqabouncerplaydirty", expect: "run-together name -> verify_entity verbatim -> CENIQA / Bouncerplaydirty guru card, NOT a guessed broker" },
  { q: "is fundedx good", expect: "prop firm; if not in DB, web_search fallback rather than dead-end" },
  { q: "is FTMO legit", expect: "known prop firm, payout framing" },
  { q: "whats gold doing today", expect: "live briefing card" },
  { q: "is pepperstone safe for uk traders", expect: "broker, FCA-confirmed" },
  { q: "where do I put my stop loss", expect: "method insight, actionable" },
];

const FILTER = process.env.ASK_SMOKE_FILTER?.toLowerCase();

describe.skipIf(!RUN)("Ask RAG smoke", () => {
  const SETS: Record<string, SmokeQuery[]> = {
    live: LIVE_QUERIES,
    diverse: DIVERSE_QUERIES,
    tough: TOUGH_QUERIES,
    propfirm: PROPFIRM_QUERIES,
  };
  const activeSet = SETS[process.env.ASK_SMOKE_SET ?? ""] ?? QUERIES;
  for (const { q, expect, history } of activeSet.filter((item) => !FILTER || item.q.toLowerCase().includes(FILTER))) {
    it(
      q,
      async () => {
        const timeline: string[] = [];
        const start = Date.now();
        const at = () => `+${Date.now() - start}ms`;
        let card: unknown = null;
        let error: string | null = null;
        try {
          const res = await generateAskResponse(
            { message: q, ...(history ? { history } : {}) },
            {},
            { onToolCall: ({ toolName }) => timeline.push(`${toolName} ${at()}`) },
          );
          card = res.data;
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        }
        const ms = Date.now() - start;
        const block = `\n———————————————————————————————————————————————\nQ: ${q}  (TOTAL ${ms}ms)\nexpect: ${expect}\ntimeline: ${timeline.join(" | ")} | done ${at()}\n${
          error ? `ERROR: ${error}` : `card: ${JSON.stringify(card, null, 2)}`
        }`;
        console.log(block);
        if (process.env.ASK_SMOKE_OUT) appendFileSync(process.env.ASK_SMOKE_OUT, block + "\n");
      },
      120_000,
    );
  }
});
