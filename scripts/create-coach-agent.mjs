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
const COACH_VOICE_ID = "cjVigY5qzO86Huf0OWal"; // Eric
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
      // ElevenLabs forbids an English *base* language on the multilingual flash v2.5 model
      // ("English Agents must use turbo or flash v2"). To keep flash v2.5 + auto-detect (the
      // task's requirement) we set a non-English base and list English as a preset; the
      // language_detection tool + Scribe auto-detect the trader's actual language per turn, and
      // the English first_message text still renders in English (flash v2.5 detects text language).
      language: "es",
      prompt: {
        // Minimal: the real persona is rebuilt per session by the custom LLM endpoint.
        prompt:
          "You are the trader's verify.trading psychology coach on a live voice call. Warm, honest, concise. The system that generates your replies already holds their full context.",
        llm: "custom-llm",
        custom_llm: {
          url: AGENT_LLM_URL,
          model_id: "verify-coach",
          request_headers: { Authorization: `Bearer ${llmSecret}` },
        },
        // Auto language detection so the coach can switch to the trader's language mid-call.
        built_in_tools: {
          language_detection: {
            name: "language_detection",
            description: "",
            params: { system_tool_type: "language_detection" },
          },
        },
      },
    },
    tts: { model_id: "eleven_flash_v2_5", voice_id: COACH_VOICE_ID },
    conversation: { max_duration_seconds: 1800 }, // billing cap
    // The languages the detection tool switches between (English included, since the base is
    // non-English above). Empty overrides = use the agent's defaults for each.
    language_presets: Object.fromEntries(
      ["en", "fr", "de", "pt", "it", "zh", "hi", "ar"].map((code) => [code, { overrides: {} }]),
    ),
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
