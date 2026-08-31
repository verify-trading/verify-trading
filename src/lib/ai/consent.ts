import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side gate for App Store 5.1.1(i): nothing reaches a third-party AI until the user
 * has agreed in the app.
 *
 * Every mobile path is also gated server-side; client prompts provide the explanation and the
 * server check prevents a modified or stale client from bypassing the user's choice.
 *
 * One versioned key covers every disclosed AI feature. The mobile app mirrors the explicit
 * answer into profiles.preferences before it resumes a held AI action. A disclosure change
 * requires a new key so existing users must make a fresh choice.
 */
export const AI_CONSENT_KEY = "ai_consent_v2";

/** Fails closed: an unreadable profile means consent is not proven, so nothing is sent. */
export async function hasAiConsent(
  supabase: SupabaseClient,
  userId: string,
  key: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", userId)
    .maybeSingle();
  if (error) return false;
  const preferences = (data?.preferences ?? {}) as Record<string, unknown>;
  return preferences[key] === true;
}
