import { createHmac, timingSafeEqual } from "node:crypto";

// The custom-LLM endpoint is reached ElevenLabs -> our server, never by the app directly, so
// the static bearer secret proves the request came from ElevenLabs. But the request BODY
// (customLlmExtraBody, echoed verbatim by ElevenLabs) is client-controlled — trusting a raw
// userId in it would let one Pro user pull another's assessment/journal into their call. So
// realtime-token mints this HMAC-signed context at auth time; agent-llm verifies the signature
// before trusting whose persona to build. Same secret (ELEVENLABS_AGENT_LLM_SECRET) both ways.

export type AgentContext = {
  userId: string;
  assessmentId: string;
  sessionId: string;
  name: string;
  exp: number; // unix seconds
};

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signAgentContext(ctx: AgentContext, secret: string): string {
  const payload = Buffer.from(JSON.stringify(ctx)).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyAgentContext(token: string, secret: string): AgentContext | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload, secret);
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;

  try {
    const ctx = JSON.parse(Buffer.from(payload, "base64url").toString()) as AgentContext;
    // Every field is checked for type, not just truthiness: sessionId keys the per-session
    // prompt cache downstream, and `typeof NaN === "number"` — with NaN every comparison is
    // false, so `exp: NaN` sailed past the expiry check below and never expired.
    if (
      typeof ctx.userId !== "string" || !ctx.userId ||
      typeof ctx.assessmentId !== "string" || !ctx.assessmentId ||
      typeof ctx.sessionId !== "string" || !ctx.sessionId ||
      typeof ctx.name !== "string" ||
      !Number.isFinite(ctx.exp)
    ) {
      return null;
    }
    if (ctx.exp < Date.now() / 1000) return null; // expired
    return ctx;
  } catch {
    return null;
  }
}
