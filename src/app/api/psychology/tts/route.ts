import { getSessionUser } from "@/lib/auth/session";
import { hasProAccess } from "@/lib/billing/require-pro";
import { jsonApiError, jsonUnauthorized } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";
import { synthesizeCoachSpeech, TTS_MAX_CHARS } from "@/lib/psychology/tts";

// Proxies ElevenLabs so the API key never reaches the client. The app plays this URL directly
// (expo-audio) with its Bearer token as a header.
export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session) return jsonUnauthorized("Sign in to use the psychology coach.");
  // Pro-only: every call bills ElevenLabs per character.
  if (!(await hasProAccess(session))) {
    return jsonApiError(403, "psychology_pro_required", "Voice coaching is a Pro feature.");
  }

  const text = new URL(request.url).searchParams.get("text")?.trim();
  if (!text) return jsonApiError(400, "tts_invalid", "Missing text to speak.");

  try {
    const speech = await synthesizeCoachSpeech(text.slice(0, TTS_MAX_CHARS), AbortSignal.timeout(20_000));
    if (!speech.ok) {
      logger.error("ElevenLabs TTS request failed.", { status: speech.status });
      return jsonApiError(502, "tts_failed", "The coach's voice is unavailable right now.");
    }
    // Buffered and returned with a Content-Length rather than piped through chunked. iOS
    // AVPlayer took ~6-7s to become playable on an unsized response, past the app's fallback
    // window, so the coach came out in the robotic device voice. Costs first-byte latency.
    const audio = await speech.arrayBuffer();
    return new Response(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.byteLength),
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    logger.error("TTS route failed.", { error: error instanceof Error ? error.message : "unknown" });
    return jsonApiError(500, "tts_failed", "The coach's voice is unavailable right now.");
  }
}
