#!/usr/bin/env node
/**
 * One-off: create the "Psychology Coach" ElevenLabs agent (WebRTC, auth required, custom LLM
 * pointed at our /api/psychology/agent-llm endpoint) and write ELEVENLABS_AGENT_ID +
 * ELEVENLABS_AGENT_LLM_SECRET into .env.local.
 *
 * Run: node scripts/create-coach-agent.mjs   (reads .env.local itself)
 *
 * Idempotent-ish: reuses an existing ELEVENLABS_AGENT_LLM_SECRET from .env.local if present, and
 * refuses to create a second agent if ELEVENLABS_AGENT_ID is already set (delete it first to redo).
 */

import { randomBytes } from "node:crypto";
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error("Missing ELEVENLABS_API_KEY (expected in .env.local).");
  process.exit(1);
}

if (process.env.ELEVENLABS_AGENT_ID) {
  console.error(`ELEVENLABS_AGENT_ID already set (${process.env.ELEVENLABS_AGENT_ID}). Delete that agent and unset it to recreate.`);
  process.exit(1);
}

const ENV_PATH = ".env.local";
const APP_URL = "https://www.verify.trading";
const COACH_VOICE_ID = "cgSgspJ2msm6clMCkdW9"; // Jessica — the only female voice tagged `conversational`
// ElevenLabs treats custom_llm.url as an OpenAI-compatible BASE and appends
// "/chat/completions" itself — so this must stay suffix-less, and the route lives at
// src/app/api/psychology/agent-llm/chat/completions/route.ts. Adding the suffix here (or
// moving the route back up a level) sends every turn to a 404: the agent speaks its
// first_message and is then silent for the rest of the call, with nothing in our logs.
const AGENT_LLM_URL = `${APP_URL}/api/psychology/agent-llm`;

// Reuse the secret if it's already in .env.local, else mint one.
function readEnvValue(key) {
  if (process.env[key]) return process.env[key];
  if (!existsSync(ENV_PATH)) return null;
  const line = readFileSync(ENV_PATH, "utf8").split("\n").find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : null;
}

const llmSecret = readEnvValue("ELEVENLABS_AGENT_LLM_SECRET") ?? randomBytes(32).toString("base64url");

const payload = {
  name: "Psychology Coach",
  conversation_config: {
    agent: {
      first_message:
        "Hey, it's your coach here. Good to have you on — take a breath, and tell me what's on your mind today.",
      // English base on flash v2. The rejection that prompted the old "Spanish base + English
      // preset" workaround was ElevenLabs enforcing its model mapping — English uses v2,
      // additional languages use v2.5 — not a ban on English as the base. That workaround
      // pinned BOTH the TTS and Scribe to Spanish for the whole call, so English replies were
      // voiced with Spanish phonetics and the trader's English was transcribed against a
      // Spanish model. Verified: PATCHing language "en" + eleven_flash_v2 returns 200.
      language: "en",
      prompt: {
        // Minimal: the real persona is rebuilt per session by the custom LLM endpoint.
        prompt:
          "You are the trader's verify.trading psychology coach on a live voice call. Warm, honest, concise. The system that generates your replies already holds their full context.",
        llm: "custom-llm",
        custom_llm: {
          url: AGENT_LLM_URL,
          model_id: "verify-coach",
          // NOT `Authorization`: that name is reserved on ElevenLabs' outbound header map —
          // it is accepted here, echoed back by their API, and then never actually sent, so
          // every turn reached us unauthenticated and 401'd. The route accepts either name;
          // this one is the one that arrives. `npm run check:agent-config` asserts it.
          request_headers: { "x-vt-agent-secret": llmSecret },
        },
        // ponytail: no built_in_tools. System tools like language_detection are LLM-invoked —
        // ElevenLabs offers them in the OpenAI `tools` array and waits for a tool_call. Our
        // custom-LLM endpoint sends no `tools` and emits no `tool_calls`, so the tool could
        // never fire; it was dead config. Mid-call language switching needs agent-llm to
        // forward tools and stream tool_call deltas first.
      },
    },
    tts: { model_id: "eleven_flash_v2", voice_id: COACH_VOICE_ID },
    conversation: { max_duration_seconds: 1800 }, // billing cap
  },
  platform_settings: {
    auth: { enable_auth: true }, // the public agent_id alone cannot connect
    overrides: { custom_llm_extra_body: true }, // let the client pass our signed vt_ctx
  },
};

const response = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
  method: "POST",
  headers: { "xi-api-key": API_KEY, "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

const text = await response.text();
if (!response.ok) {
  console.error(`Agent create failed (${response.status}):\n${text}`);
  process.exit(1);
}

const agentId = JSON.parse(text).agent_id;
if (!agentId) {
  console.error(`No agent_id in response:\n${text}`);
  process.exit(1);
}

// Persist to .env.local (append only the keys not already present).
const existing = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
let toAppend = "\n";
if (!existing.includes("ELEVENLABS_AGENT_ID=")) toAppend += `ELEVENLABS_AGENT_ID=${agentId}\n`;
if (!existing.includes("ELEVENLABS_AGENT_LLM_SECRET=")) toAppend += `ELEVENLABS_AGENT_LLM_SECRET=${llmSecret}\n`;
if (toAppend.trim()) appendFileSync(ENV_PATH, toAppend);

console.log("\n✅ Psychology Coach agent created.\n");
console.log(`  agent_id: ${agentId}`);
console.log(`  wrote ELEVENLABS_AGENT_ID + ELEVENLABS_AGENT_LLM_SECRET to ${ENV_PATH}\n`);
console.log("➡️  Add these to Vercel (Project → Settings → Environment Variables, Production + Preview):\n");
console.log(`  ELEVENLABS_AGENT_ID = ${agentId}`);
console.log(`  ELEVENLABS_AGENT_LLM_SECRET = ${llmSecret}\n`);
