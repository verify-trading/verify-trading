// ElevenLabs text-to-speech for the AI voice coach. The multilingual turbo model
// auto-detects the language of the text and speaks it naturally, so the coach can reply
// in the trader's own language. The API key stays server-side; the app streams the audio
// from our own route (see app/api/psychology/tts).

const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";

// "Sarah" — mature, reassuring, confident. A calm coach voice.
const COACH_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";
// 32 languages, low latency — good for a back-and-forth call.
const COACH_MODEL_ID = "eleven_turbo_v2_5";

export const TTS_MAX_CHARS = 800;

// Returns the raw ElevenLabs streaming response so the route can pipe the audio straight
// through without buffering it. Throws if the key is unset.
export async function synthesizeCoachSpeech(text: string, signal?: AbortSignal): Promise<Response> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not configured.");

  return fetch(`${ELEVENLABS_TTS_URL}/${COACH_VOICE_ID}/stream?output_format=mp3_44100_128`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "content-type": "application/json",
      accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: text.slice(0, TTS_MAX_CHARS),
      model_id: COACH_MODEL_ID,
      voice_settings: { stability: 0.4, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true },
    }),
    signal,
  });
}
