#!/usr/bin/env node
/**
 * Drift check for the ElevenLabs coach agent — READ ONLY, never PATCHes.
 *
 * Run: npm run check:agent-config   (reads .env.local itself)
 *
 * Why this exists: the agent's config is hand-set in the ElevenLabs dashboard and nothing in
 * this repo pins it, so a silent change there breaks every voice call with nothing in our
 * logs to say why. The failures are all quiet ones — a custom_llm.url with a "/chat/
 * completions" suffix (ElevenLabs appends that itself, so the agent 404s every turn and just
 * goes mute after its first_message), an auth header that no longer matches
 * ELEVENLABS_AGENT_LLM_SECRET (every turn 401s), an api_key or auth_connection set (the
 * request stops carrying our header), or llm flipped off "custom-llm" (our persona is never
 * built at all and the trader talks to a stock agent).
 *
 * Header note: `Authorization` is reserved on ElevenLabs' outbound request-header map — it is
 * accepted, echoed back by the API, and never actually sent. That is why the contract is
 * `x-vt-agent-secret`; the route accepts both, but only this one is asserted here.
 *
 * If you ever DO need to change this agent: a PATCH to
 * /v1/convai/agents/{id} that sets conversation_config.agent.prompt.custom_llm MUST include
 * `llm: "custom-llm"` in the same payload, or the API answers 400 without saying which field
 * it disliked. Do that by hand or in create-coach-agent.mjs — never here.
 *
 * Secrets are compared as SHA-256 digests and are never printed.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

// The one production agent. Held here as well as in the env so that repointing
// ELEVENLABS_AGENT_ID — which changes which agent production actually mints tokens for — is
// itself reported as drift instead of silently checking the wrong agent.
const PRODUCTION_AGENT_ID = "agent_6801ky839b5mehyt9z417wytem2s";

// custom_llm.url is an OpenAI-compatible BASE: ElevenLabs appends "/chat/completions".
const EXPECTED = {
  "prompt.llm": "custom-llm",
  "prompt.custom_llm.url": "https://www.verify.trading/api/psychology/agent-llm",
  "prompt.custom_llm.model_id": "verify-coach",
  "prompt.custom_llm.api_key": null,
  "prompt.custom_llm.auth_connection": null,
};

// The turn-taking / noise tuning, pinned. Every value here is a deliberate move off a platform
// default that scripts/tune-coach-agent.mjs sets (and justifies, one comment per value); this
// is the half that CATCHES it going away. Recreating the agent, or a dashboard edit, silently
// puts the call back on defaults — a 7s turn timeout that talks over a thinking trader, no
// background-voice filtering, no hang-up on an abandoned call — and nothing else in the repo
// would say so. Re-run the tune script to fix any drift reported here.
const EXPECTED_TUNING = {
  "agent.first_message":
    "Hey, it's your Companion here. Good to have you on — take a breath, and tell me what's on your mind today.",
  "turn.turn_timeout": 15,
  "turn.turn_eagerness": "patient",
  "turn.retranscribe_on_turn_timeout": true,
  "turn.silence_end_call_timeout": 100,
  "turn.soft_timeout_config.timeout_seconds": 4,
  "vad.background_voice_detection": true,
};

const SECRET_HEADER = "x-vt-agent-secret";

const apiKey = process.env.ELEVENLABS_API_KEY;
const agentId = process.env.ELEVENLABS_AGENT_ID;
const llmSecret = process.env.ELEVENLABS_AGENT_LLM_SECRET;

const missing = [
  ["ELEVENLABS_API_KEY", apiKey],
  ["ELEVENLABS_AGENT_ID", agentId],
  ["ELEVENLABS_AGENT_LLM_SECRET", llmSecret],
].filter(([, value]) => !value).map(([name]) => name);

if (missing.length > 0) {
  console.error(`Cannot check the agent config: missing ${missing.join(", ")} (expected in .env.local).`);
  process.exit(1);
}

const digest = (value) => createHash("sha256").update(String(value)).digest();
const sameSecret = (a, b) => timingSafeEqual(digest(a), digest(b));

const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(agentId)}`, {
  headers: { "xi-api-key": apiKey },
  signal: AbortSignal.timeout(15_000),
});

if (!response.ok) {
  console.error(`Agent read failed (${response.status}) for ${agentId}. Check ELEVENLABS_API_KEY and the agent id.`);
  process.exit(1);
}

const agent = await response.json();
const prompt = agent?.conversation_config?.agent?.prompt ?? {};
const customLlm = prompt.custom_llm ?? {};

const actual = {
  "prompt.llm": prompt.llm,
  "prompt.custom_llm.url": customLlm.url,
  "prompt.custom_llm.model_id": customLlm.model_id,
  "prompt.custom_llm.api_key": customLlm.api_key,
  "prompt.custom_llm.auth_connection": customLlm.auth_connection,
};

const drift = [];

if (agentId !== PRODUCTION_AGENT_ID) {
  drift.push(`ELEVENLABS_AGENT_ID: expected ${PRODUCTION_AGENT_ID}, env points at ${agentId}`);
}

const turn = agent?.conversation_config?.turn ?? {};
const actualTuning = {
  "agent.first_message": agent?.conversation_config?.agent?.first_message,
  "turn.turn_timeout": turn.turn_timeout,
  "turn.turn_eagerness": turn.turn_eagerness,
  "turn.retranscribe_on_turn_timeout": turn.retranscribe_on_turn_timeout,
  "turn.silence_end_call_timeout": turn.silence_end_call_timeout,
  "turn.soft_timeout_config.timeout_seconds": turn.soft_timeout_config?.timeout_seconds,
  "vad.background_voice_detection": agent?.conversation_config?.vad?.background_voice_detection,
};

for (const [field, expected] of Object.entries({ ...EXPECTED, ...EXPECTED_TUNING })) {
  const value = field in actual ? actual[field] : actualTuning[field];
  if (value !== expected) {
    drift.push(`${field}: expected ${JSON.stringify(expected)}, agent has ${JSON.stringify(value)}`);
  }
}

// Header names are case-insensitive; the value is the shared secret, so only its match is reported.
const headers = customLlm.request_headers ?? {};
const secretHeader = Object.entries(headers).find(([name]) => name.toLowerCase() === SECRET_HEADER);
const headerNames = Object.keys(headers).join(", ") || "none";

if (!secretHeader) {
  drift.push(`prompt.custom_llm.request_headers: no "${SECRET_HEADER}" (present: ${headerNames}) — every turn would 401`);
} else if (typeof secretHeader[1] !== "string" || !sameSecret(secretHeader[1], llmSecret)) {
  drift.push(`prompt.custom_llm.request_headers["${SECRET_HEADER}"]: does not match ELEVENLABS_AGENT_LLM_SECRET — every turn would 401`);
}

if (drift.length > 0) {
  console.error(`\n❌ ElevenLabs agent config has drifted (${agentId}):\n`);
  for (const line of drift) console.error(`  - ${line}`);
  console.error("\nTuning drift: re-run npm run tune:agent-config. Wiring drift: fix it in the");
  console.error("ElevenLabs dashboard (or with a PATCH that also sends llm: \"custom-llm\").\n");
  process.exit(1);
}

console.log(`✅ ElevenLabs agent config matches (${agentId}).`);
console.log(`   llm=${actual["prompt.llm"]}  model_id=${actual["prompt.custom_llm.model_id"]}`);
console.log(`   url=${actual["prompt.custom_llm.url"]}`);
console.log(`   api_key=null  auth_connection=null  ${SECRET_HEADER}=matches ELEVENLABS_AGENT_LLM_SECRET`);
console.log(`   request headers on the agent: ${headerNames}`);
console.log(
  `   turn_timeout=${actualTuning["turn.turn_timeout"]}s  eagerness=${actualTuning["turn.turn_eagerness"]}  retranscribe=${actualTuning["turn.retranscribe_on_turn_timeout"]}  silence_end_call=${actualTuning["turn.silence_end_call_timeout"]}s  soft_timeout=${actualTuning["turn.soft_timeout_config.timeout_seconds"]}s  background_voice_detection=${actualTuning["vad.background_voice_detection"]}`,
);
