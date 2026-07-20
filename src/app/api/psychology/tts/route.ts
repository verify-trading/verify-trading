import { getSessionUser } from "@/lib/auth/session";
import { hasProAccess } from "@/lib/billing/require-pro";
import { jsonApiError, jsonUnauthorized } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";
import { synthesizeCoachSpeech, TTS_MAX_CHARS } from "@/lib/psychology/tts";

// Streams the coach's reply as speech. Auth-gated (so it can't be used to burn TTS
// credits), and it proxies ElevenLabs so the API key never reaches the client. The app
// plays this URL directly (expo-audio) with its Bearer token as a header.
export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session) return jsonUnauthorized("Sign in to use the psychology coach.");
  // Pro-only: every call bills ElevenLabs per character, so entitlement is checked
  // here rather than trusting the client to hide the entry point.
  if (!(await hasProAccess(session))) {
    return jsonApiError(403, "psychology_pro_required", "Voice coaching is a Pro feature.");
  }

  const text = new URL(request.url).searchParams.get("text")?.trim();
  if (!text) return jsonApiError(400, "tts_invalid", "Missing text to speak.");

  try {
    const speech = await synthesizeCoachSpeech(text.slice(0, TTS_MAX_CHARS), AbortSignal.timeout(20_000));
    if (!speech.ok || !speech.body) {
      logger.error("ElevenLabs TTS request failed.", { status: speech.status });
      return jsonApiError(502, "tts_failed", "The coach's voice is unavailable right now.");
    }
    return new Response(speech.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    logger.error("TTS route failed.", { error: error instanceof Error ? error.message : "unknown" });
    return jsonApiError(500, "tts_failed", "The coach's voice is unavailable right now.");
  }
}
