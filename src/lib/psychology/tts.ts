// ElevenLabs text-to-speech for the AI voice coach. The multilingual turbo model
// auto-detects the language of the text and speaks it naturally, so the coach can reply
// in the trader's own language. The API key stays server-side; the app streams the audio
// from our own route (see app/api/psychology/tts).

const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";

// "Jessica" — bright, warm, and the only FEMALE voice ElevenLabs tags `conversational`,
// which is the property that matters: an `entertainment_tv` voice ("Sarah") is an announcer
// read being asked to hold a phone conversation, and that mismatch — not the model — was
// most of why the coach used to sound synthetic. Client asked for a female coach; Jessica
// is the one that keeps the conversational read.
const COACH_VOICE_ID = "cgSgspJ2msm6clMCkdW9";
// Flash v2.5 — fastest multilingual model (~75ms, 32 languages ⊇ our coverage, 50% cheaper).
// The binding constraint is not ElevenLabs latency (~2s) but the client's time-to-*playable*:
// iOS AVPlayer needs small, sized audio (see the route) to beat the app's fallback window, or
// the coach comes out in the robotic device voice. multilingual_v2 is a little more expressive
// on long emotional reads and barely different on short coach turns — not worth that window.
const COACH_MODEL_ID = "eleven_flash_v2_5";

export const TTS_MAX_CHARS = 800;

// Returns the raw ElevenLabs streaming response so the route can pipe the audio straight
// through without buffering it. Throws if the key is unset.
export async function synthesizeCoachSpeech(text: string, signal?: AbortSignal): Promise<Response> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not configured.");

  // output_format mp3_44100_64: half the bytes of _128 (faster to buffer + deliver) with
  // negligible quality loss for speech. optimize_streaming_latency=3 = max latency opts;
  // NOT 4 — level 4 disables the number normalizer and the coach speaks prices/percent/dates.
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
      // Lower stability = more pitch/pace variation, which is what reads as human rather
      // than read-aloud; style adds delivery colour. Pushed too far either becomes unstable.
      voice_settings: { stability: 0.35, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true },
    }),
    signal,
  });
}
