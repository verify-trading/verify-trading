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
    if (!speech.ok) {
      logger.error("ElevenLabs TTS request failed.", { status: speech.status });
      return jsonApiError(502, "tts_failed", "The coach's voice is unavailable right now.");
    }
    // Buffer the whole clip and return it with a Content-Length rather than piping the
    // chunked stream through. The clip is tiny (~30–60 KB) and iOS AVPlayer was slow to
    // become playable on a chunked, unsized response (~6–7s — past the app's fallback
    // window, so the coach fell back to the robotic device voice). A sized response plays
    // near-instantly. Costs a little first-byte latency (we await the full generation) for
    // a much faster, reliable time-to-playable on the client.
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
