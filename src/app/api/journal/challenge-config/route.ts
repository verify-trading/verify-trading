import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { jsonApiError, jsonUnauthorized } from "@/lib/http/json-response";
import { challengeConfigSchema, extractChallengeRules, toChallengeConfig, type ChallengeConfigRow } from "@/lib/journal/challenge";
import { logger } from "@/lib/observability/logger";

const PRIVATE_CACHE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

export async function GET() {
  const session = await getSessionUser();
  if (!session) return jsonUnauthorized("Sign in to load challenge mode.");

  const { data, error } = await session.supabase
    .from("challenge_config")
    .select("id, firm_name, firm_url, account_size, account_type, rules, created_at, updated_at")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) return jsonApiError(500, "challenge_config_unavailable", "Could not load challenge mode.");
  return NextResponse.json({ config: data ? toChallengeConfig(data as ChallengeConfigRow) : null }, { headers: PRIVATE_CACHE_HEADERS });
}

export async function POST(request: Request) {
  const parsed = challengeConfigSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonApiError(400, "challenge_config_invalid", "The challenge mode setup is invalid.");

  try {
    const session = await getSessionUser();
    if (!session) return jsonUnauthorized("Sign in to set up challenge mode.");

    const rules = await extractChallengeRules(parsed.data);
    const { data, error } = await session.supabase
      .from("challenge_config")
      .upsert({
        user_id: session.user.id,
        firm_name: rules.firm_name,
        firm_url: parsed.data.firmUrl,
        account_size: parsed.data.accountSize,
        account_type: parsed.data.accountType,
        rules,
      }, { onConflict: "user_id" })
      .select("id, firm_name, firm_url, account_size, account_type, rules, created_at, updated_at")
      .single();

    if (error || !data) return jsonApiError(500, "challenge_config_save_failed", "Could not save challenge mode.");
    return NextResponse.json({ config: toChallengeConfig(data as ChallengeConfigRow) }, { status: 201, headers: PRIVATE_CACHE_HEADERS });
  } catch (error) {
    logger.error("Challenge config save failed.", { error: error instanceof Error ? error.message : "unknown" });
    return jsonApiError(500, "challenge_config_save_failed", "Could not save challenge mode.");
  }
}
