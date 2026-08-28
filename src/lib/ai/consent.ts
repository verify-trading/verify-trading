import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side gate for App Store 5.1.1(i): nothing reaches a third-party AI until the user
 * has agreed in the app.
 *
 * Ask and the Mind call are gated client-side, because the client starts them. The journal AI
 * is not: `generateChallengeStatus` runs as a side effect of saving an entry, and
 * `generateWeeklyInsight` runs when the Journal tab opens. There is no user action to hang a
 * prompt on, so the check has to live here, where every path goes through it.
 *
 * One key covers every AI feature, matching the single consent dialog in the app. It is
 * written by writeSyncedFlag (mobile src/lib/profilePrefs.ts), which mirrors consent into
 * profiles.preferences precisely so the server can read it.
 */
export const AI_CONSENT_KEY = "ai_consent_v1";

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
