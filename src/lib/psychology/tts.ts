// ElevenLabs text-to-speech for the AI voice coach. The multilingual turbo model
// auto-detects the language of the text and speaks it naturally, so the coach can reply
// in the trader's own language. The API key stays server-side; the app streams the audio
// from our own route (see app/api/psychology/tts).

const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";

// "Eric" — smooth, trustworthy, middle-aged. ElevenLabs tags him `conversational`,
// which is the point: the previous voice ("Sarah") is tagged `entertainment_tv`, an
// announcer read being asked to hold a phone conversation. That mismatch, not the model,
// was most of why the coach sounded synthetic.
const COACH_VOICE_ID = "cjVigY5qzO86Huf0OWal";
// Flash v2.5 — ElevenLabs' fastest multilingual model (~75ms inference, 32 languages ⊇ our
// coverage, 50% cheaper). We moved off multilingual_v2 because the real bottleneck was never
// ElevenLabs latency (~2s) but the client's time-to-*playable*: iOS AVPlayer was slow to
// become ready, so the coach kept falling back to the device voice. Flash's smaller/faster
// output plus the buffered Content-Length response (see the route) is what wins the client's
// fallback window. Flash is marginally less expressive than multilingual_v2 on long emotional
// reads; for short back-and-forth coach turns the difference is barely audible.
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
