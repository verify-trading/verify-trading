const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";

// "Jessica" — the only female voice ElevenLabs tags `conversational`. An `entertainment_tv`
// voice reads like an announcer, which is most of why the coach used to sound synthetic.
const COACH_VOICE_ID = "cgSgspJ2msm6clMCkdW9";
// Flash v2.5: fastest multilingual model (~75ms, 32 languages, 50% cheaper).
const COACH_MODEL_ID = "eleven_flash_v2_5";

export const TTS_MAX_CHARS = 800;

// Every request bills ElevenLabs per character against a fixed-price subscription, and unlike a
// voice call nothing else bounds this route — the call cap is enforced at token mint, which this
// path never touches. A day of ordinary coaching is nowhere near this; a client stuck in a retry
// loop passes it in seconds.
const TTS_DAILY_CHARS = 60_000;

// userId -> characters spoken today, and the UTC day that count belongs to.
const spend = new Map<string, { day: number; chars: number }>();

/**
 * Books `chars` against today's allowance, or refuses. Charged BEFORE synthesis: a request that
 * fails at ElevenLabs may still have been billed, so refunding on error would let a failing loop
 * run free.
 *
 * ponytail: module memory, so on serverless this is per warm instance rather than global — it
 * bounds a runaway client, not a determined attacker spraying cold starts. Move the counter to a
 * table (as the $2.10 broker create budget does) if the spend ever justifies it.
 */
export function claimTtsChars(userId: string, chars: number): boolean {
  const day = Math.floor(Date.now() / 86_400_000);
  const current = spend.get(userId);
  const used = current?.day === day ? current.chars : 0;
  if (used + chars > TTS_DAILY_CHARS) {
    spend.set(userId, { day, chars: used });
    return false;
  }
  spend.set(userId, { day, chars: used + chars });
  return true;
}

export async function synthesizeCoachSpeech(text: string, signal?: AbortSignal): Promise<Response> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not configured.");

  // mp3_44100_64: half the bytes of _128, negligible quality loss for speech.
  // latency=3, NOT 4 — level 4 disables the number normalizer and the coach speaks
  // prices/percent/dates.
  return fetch(`${ELEVENLABS_TTS_URL}/${COACH_VOICE_ID}/stream?output_format=mp3_44100_64&optimize_streaming_latency=3`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "content-type": "application/json",
      accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: text.slice(0, TTS_MAX_CHARS),
      model_id: COACH_MODEL_ID,
      // Tuning knob: lower stability = more pitch/pace variation. Too low becomes unstable.
      voice_settings: { stability: 0.35, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true },
    }),
    signal,
  });
}
