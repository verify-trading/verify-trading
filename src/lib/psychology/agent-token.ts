import { createHmac, timingSafeEqual } from "node:crypto";

// Binds a call to one user + session + assessment. The bearer secret proves a request came
// from ElevenLabs, but the BODY (customLlmExtraBody, echoed verbatim) is client-controlled:
// a raw userId in it would let one Pro user pull another's assessment/journal into their call.
// realtime-token signs this at auth time, agent-llm verifies it before building a persona.
// Same secret (ELEVENLABS_AGENT_LLM_SECRET) both ways.

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

// `ignoreExpiry` is for matching a finished call's transcript back to its session, days later.
// Expiry bounds who may START a call; whose transcript this is rests on the signature alone.
// Never pass it on the live turn path.
export function verifyAgentContext(
  token: string,
  secret: string,
  { ignoreExpiry = false }: { ignoreExpiry?: boolean } = {},
): AgentContext | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload, secret);
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;

  try {
    const ctx = JSON.parse(Buffer.from(payload, "base64url").toString()) as AgentContext;
    // Typed, not just truthy: `typeof NaN === "number"`, so `exp: NaN` sailed past the expiry
    // check below and never expired.
    if (
      typeof ctx.userId !== "string" || !ctx.userId ||
      typeof ctx.assessmentId !== "string" || !ctx.assessmentId ||
      typeof ctx.sessionId !== "string" || !ctx.sessionId ||
      typeof ctx.name !== "string" ||
      !Number.isFinite(ctx.exp)
    ) {
      return null;
    }
    if (!ignoreExpiry && ctx.exp < Date.now() / 1000) return null; // expired
    return ctx;
  } catch {
    return null;
  }
}
