const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";

// "Jessica" — the only female voice ElevenLabs tags `conversational`. An `entertainment_tv`
// voice reads like an announcer, which is most of why the coach used to sound synthetic.
const COACH_VOICE_ID = "cgSgspJ2msm6clMCkdW9";
// Flash v2.5: fastest multilingual model (~75ms, 32 languages, 50% cheaper).
const COACH_MODEL_ID = "eleven_flash_v2_5";

export const TTS_MAX_CHARS = 800;

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
