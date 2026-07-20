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
// The most lifelike model ElevenLabs still endorses for real-time agents (v3 is excluded
// for first-token latency; Flash trades emotional depth for speed we do not need).
// Measured time-to-first-audio: flash 0.92s, turbo 1.07s, multilingual 1.83s — all well
// inside the client's 6s fallback window, so we can afford the most human of the three.
const COACH_MODEL_ID = "eleven_multilingual_v2";

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
      // Lower stability = more pitch/pace variation, which is what reads as human rather
      // than read-aloud; style adds delivery colour. Pushed too far either becomes unstable.
      voice_settings: { stability: 0.35, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true },
    }),
    signal,
  });
}
