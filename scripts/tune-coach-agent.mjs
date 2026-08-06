#!/usr/bin/env node
/**
 * Turn-taking / noise tuning for the ElevenLabs coach agent.
 *
 * Run: npm run tune:agent-config   (reads .env.local itself)
 *
 * Why this exists: the agent was created with NO `turn`, `asr` or `vad` block at all, so every
 * call ran on platform defaults — a 7-second turn timeout and no background-voice filtering.
 * On a live call from a noisy room that produced the three things the client reported:
 *
 *   "kept cutting off when any background sound was being picked up"
 *     -> background chatter reached the VAD as speech and barged in on the coach mid-sentence,
 *        and the same chatter split the trader's own sentence into fragments.
 *   "the voice replayed a greeting and instructed us how to interact with it"
 *     -> the 7s turn timeout fired while they were still thinking (or while their speech was
 *        lost in the noise). ElevenLabs then asks our custom LLM for another turn with NO new
 *        user message, and the model — seeing only its own last line — starts the call over.
 *        Fixed on BOTH sides: the timeout below, and a no-new-input guard in the agent-llm
 *        route (src/app/api/psychology/agent-llm/chat/completions/route.ts).
 *   "the voice recognition and response was a bit delayed"
 *     -> our LLM reaches first token in ~2.4s warm, 8.5s worst warm, 20.9s cold (measured, see
 *        the margin note in the agent-llm route). Nothing is spoken during that window, so the
 *        call sounds dead. soft_timeout_config fills it with one short human noise.
 *
 * It also sets the agent's spoken first_message, which is the only line the trader hears before
 * our persona takes over — and the only place the product still called itself "your coach"
 * while every screen said Companion.
 *
 * Idempotent: re-running PATCHes the same values and prints the settled config. The backup is
 * written once per day and never overwritten, so a second run cannot clobber the pre-change
 * snapshot with an already-tuned one. Every value it sets is asserted against the settled
 * config afterwards, so a silently-dropped field exits 1 instead of printing a tick.
 *
 * PATCH quirk (project memory): a payload touching conversation_config.agent.prompt.custom_llm
 * is rejected 400 unless `llm: "custom-llm"` rides along in the same payload. This script never
 * touches `prompt` for that reason — first_message is a sibling of it, not inside it — and
 * deliberately never echoes request_headers back, so the shared secret cannot be rewritten (or
 * masked) by a tuning run. The assertion below re-checks the wiring survived regardless.
 */

import { writeFileSync, existsSync } from "node:fs";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const apiKey = process.env.ELEVENLABS_API_KEY;
const agentId = process.env.ELEVENLABS_AGENT_ID;
if (!apiKey || !agentId) {
  console.error("Missing ELEVENLABS_API_KEY / ELEVENLABS_AGENT_ID (expected in .env.local).");
  process.exit(1);
}

// Same guard as check-agent-config.mjs, for the same reason: repointing ELEVENLABS_AGENT_ID
// changes which agent production mints tokens for, and this script WRITES. Tuning the wrong
// agent leaves production on defaults with a green console to say it worked.
const PRODUCTION_AGENT_ID = "agent_6801ky839b5mehyt9z417wytem2s";
if (agentId !== PRODUCTION_AGENT_ID) {
  console.error(`ELEVENLABS_AGENT_ID is ${agentId}, expected ${PRODUCTION_AGENT_ID}. Refusing to tune a different agent.`);
  process.exit(1);
}

const AGENT_URL = `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(agentId)}`;

// The app calls this thing the Companion everywhere the trader can see it, so the one line the
// agent speaks before our persona takes over has to as well — "it's your coach here" introduced
// a product the UI never mentions. Same warmth, same shape. Kept in step with
// create-coach-agent.mjs, which sets it on a freshly created agent.
const FIRST_MESSAGE =
  "Hey, it's your Companion here. Good to have you on — take a breath, and tell me what's on your mind today.";

// Every value below is a deliberate move off a platform default, and every one names the
// client symptom it answers. Conservative on purpose: nothing here changes the voice, the
// model, or the custom-LLM wiring.
const TUNED_TURN = {
  // Default 7s. A trader asked "what was going through your head on that loss?" needs longer
  // than seven seconds of silence before the companion assumes they're done and takes the floor.
  // 15s is half the documented 1-30 ceiling: long enough to think in, short enough that a
  // genuinely dropped turn still recovers inside one breath.
  // Symptom: "replayed a greeting ... as if we hadn't already tried to speak".
  turn_timeout: 15,
  // Default "normal". "patient" makes the agent wait longer before deciding the user's turn
  // ended — the direct answer to sentences being cut off mid-thought in a noisy room.
  // Symptom: "kept cutting off".
  turn_eagerness: "patient",
  // Default false. When the timeout fires and VAD saw no speech, re-transcribe the audio that
  // accumulated anyway. In a loud room the trader DID speak; the VAD just lost it in the
  // noise. This turns "the coach ignored us and restarted" into a late but correct reply.
  // Cost note: this forfeits ElevenLabs' silence billing discount. Set back to false if the
  // per-minute bill matters more than the noisy-room recovery.
  // Symptom: "we both tried to speak ... as if we hadn't".
  retranscribe_on_turn_timeout: true,
  // Default -1 (never hangs up). A call the trader walked away from otherwise runs to
  // max_duration_seconds (1800) being billed, while the platform asks our LLM for a fresh turn
  // every turn_timeout seconds. 100s is deliberate against the 15s above: the agent-llm route
  // answers the first silence with a warm nudge (15s) and the second with one steady "I'll stay
  // on the line" (30s), then says nothing — so 100s leaves a trader who put the phone down to
  // think roughly a minute of quiet after that last line before the platform ends the call.
  // Below ~90s it would cut off someone genuinely gathering themselves after a hard question;
  // above ~120s it stops being a hang-up and starts being a bill.
  silence_end_call_timeout: 100,
  // Default -1 (off). Our LLM's first token lands at ~2.4s warm and up to ~20.9s cold, and
  // the trader hears pure silence for all of it. One short human noise at 4s says "I'm still
  // here" without pre-empting the real answer (which is usually already arriving by then).
  // Symptom: "the voice recognition and response was a bit delayed".
  soft_timeout_config: {
    timeout_seconds: 4,
    message: "Mm, let me sit with that a second.",
    // One filler played verbatim on every slow turn is its own tell — three turns in, the
    // trader has learned that exact noise means the machine is thinking. A small set, picked
    // at random, reads as a person rather than a loading spinner with a voice.
    additional_soft_timeout_messages: [
      "Mm-hm, one sec.",
      "Right, let me think about that.",
      "Okay — bear with me a moment.",
    ],
    randomize_fillers: true,
  },
};

// Default false. The one background-noise control the agent schema actually has: filters
// voices that are not the person on the call, so a conversation at the next table cannot
// barge in on the companion or fragment the trader's turn.
// Symptom: "the location we were in was too noisy".
const TUNED_VAD = { background_voice_detection: true };

// The `turn` block's other load-bearing fields, echoed back from the LIVE config. The PATCH is
// documented as a deep merge, but a merge that replaces the `turn` object wholesale would drop
// these — and each one silently changes every call: `mode` is what makes it a turn-taking agent
// at all, `turn_model` is the endpointing model, `speculative_turn` is what starts our LLM
// before the trader has finished speaking (the thing keeping first-token latency tolerable).
// Read from the agent rather than pinned here so this script cannot revert a dashboard change
// it knows nothing about.
const SIBLING_TURN_FIELDS = ["mode", "turn_model", "speculative_turn"];

function patchPayload(current) {
  const turn = current?.conversation_config?.turn ?? {};
  const siblings = Object.fromEntries(
    SIBLING_TURN_FIELDS.filter((field) => turn[field] !== undefined && turn[field] !== null).map((field) => [field, turn[field]]),
  );
  return {
    conversation_config: {
      agent: { first_message: FIRST_MESSAGE },
      turn: { ...siblings, ...TUNED_TURN },
      vad: TUNED_VAD,
    },
  };
}

async function getAgent() {
  const response = await fetch(AGENT_URL, {
    headers: { "xi-api-key": apiKey },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`Agent read failed (${response.status}) for ${agentId}:\n${text}`);
    process.exit(1);
  }
  return JSON.parse(text);
}

// The fields this script owns, flattened, so before/after is one readable table AND the
// assertion below is one loop. Every key here is a value the script sets; if the PATCH silently
// declined one of them, this is where it shows up.
function settled(agent) {
  const turn = agent?.conversation_config?.turn ?? {};
  const soft = turn.soft_timeout_config ?? {};
  return {
    "agent.first_message": agent?.conversation_config?.agent?.first_message,
    "turn.turn_timeout": turn.turn_timeout,
    "turn.turn_eagerness": turn.turn_eagerness,
    "turn.retranscribe_on_turn_timeout": turn.retranscribe_on_turn_timeout,
    "turn.silence_end_call_timeout": turn.silence_end_call_timeout,
    "turn.soft_timeout_config.timeout_seconds": soft.timeout_seconds,
    "turn.soft_timeout_config.message": soft.message,
    "turn.soft_timeout_config.additional_soft_timeout_messages": soft.additional_soft_timeout_messages,
    "turn.soft_timeout_config.randomize_fillers": soft.randomize_fillers,
    "vad.background_voice_detection": agent?.conversation_config?.vad?.background_voice_detection,
  };
}

// What settled() must report once the PATCH lands. Derived from the same constants that are
// sent, so the two cannot drift apart.
const EXPECTED = {
  "agent.first_message": FIRST_MESSAGE,
  "turn.turn_timeout": TUNED_TURN.turn_timeout,
  "turn.turn_eagerness": TUNED_TURN.turn_eagerness,
  "turn.retranscribe_on_turn_timeout": TUNED_TURN.retranscribe_on_turn_timeout,
  "turn.silence_end_call_timeout": TUNED_TURN.silence_end_call_timeout,
  "turn.soft_timeout_config.timeout_seconds": TUNED_TURN.soft_timeout_config.timeout_seconds,
  "turn.soft_timeout_config.message": TUNED_TURN.soft_timeout_config.message,
  "turn.soft_timeout_config.additional_soft_timeout_messages": TUNED_TURN.soft_timeout_config.additional_soft_timeout_messages,
  "turn.soft_timeout_config.randomize_fillers": TUNED_TURN.soft_timeout_config.randomize_fillers,
  "vad.background_voice_detection": TUNED_VAD.background_voice_detection,
};

const before = await getAgent();

// Snapshot BEFORE anything changes. Never overwritten: a second run today must not replace the
// pre-change config with the tuned one.
const backupPath = `scripts/agent-config-backup-${new Date().toISOString().slice(0, 10)}.json`;
if (existsSync(backupPath)) {
  console.log(`Backup ${backupPath} already exists — keeping the original snapshot.`);
} else {
  writeFileSync(backupPath, `${JSON.stringify(before, null, 2)}\n`);
  console.log(`Backed up the live agent config to ${backupPath}`);
}
// .gitignore already carries `scripts/agent-config-backup-*.json` (the snapshot holds the agent
// LLM secret). It used to be appended from here, which meant a script whose whole job is a
// PATCH also edited a tracked file on first run — the ignore line belongs in the repo, not in
// this script's runtime.

console.log("\nBefore:");
console.table(settled(before));

const response = await fetch(AGENT_URL, {
  method: "PATCH",
  headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
  body: JSON.stringify(patchPayload(before)),
  signal: AbortSignal.timeout(20_000),
});

const responseText = await response.text();
if (!response.ok) {
  console.error(`\n❌ PATCH failed (${response.status}):\n${responseText}`);
  console.error("\nNothing was changed. The agent is still as backed up above.");
  process.exit(1);
}

// The PATCH answers with the settled agent (the same GetAgentResponseModel a GET returns), so
// a second read would only be a second chance for the two to disagree.
const after = JSON.parse(responseText);
console.log("\nAfter:");
console.table(settled(after));

// A 200 means the API accepted the payload, not that it kept every field — an unknown key is
// dropped silently, and a merge that replaces a block takes its siblings with it. Assert what
// actually settled, and say exactly which value did not take.
const actual = settled(after);
const drift = Object.entries(EXPECTED)
  .filter(([field, expected]) => JSON.stringify(actual[field]) !== JSON.stringify(expected))
  .map(([field, expected]) => `${field}: expected ${JSON.stringify(expected)}, agent has ${JSON.stringify(actual[field])}`);

// The one thing that silently breaks every call if a merge drops it: the custom-LLM wiring.
const prompt = after?.conversation_config?.agent?.prompt ?? {};
if (prompt.llm !== "custom-llm" || typeof prompt.custom_llm?.url !== "string") {
  drift.push(`custom-LLM wiring: llm=${JSON.stringify(prompt.llm)}, custom_llm.url=${JSON.stringify(prompt.custom_llm?.url)} — restore from ${backupPath} NOW`);
}

if (drift.length > 0) {
  console.error(`\n❌ The PATCH did not take on ${drift.length} value(s):\n`);
  for (const line of drift) console.error(`  - ${line}`);
  console.error(`\nThe pre-change config is in ${backupPath}. Run npm run check:agent-config.\n`);
  process.exit(1);
}

console.log("\n✅ Companion agent tuned — every value asserted against the settled config.\n");
