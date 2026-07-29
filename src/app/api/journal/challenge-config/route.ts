import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { jsonApiError, jsonUnauthorized, PRIVATE_CACHE_HEADERS } from "@/lib/http/json-response";
import { challengeConfigSchema, challengeStartedAt, extractChallengeRules, reuseStoredRules, toChallengeConfig, type ChallengeConfigRow } from "@/lib/journal/challenge";
import { UnsafeUrlError } from "@/lib/http/safe-fetch";
import { logger } from "@/lib/observability/logger";

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

    // If the trader already has a config for the same firm + account type with all-percentage
    // core rules, an accountSize change needs no re-scrape (percentages are size-independent;
    // the app converts client-side). Otherwise extract fresh.
    const { data: priorRow } = await session.supabase
      .from("challenge_config")
      .select("firm_url, account_type, account_size, rules")
      .eq("user_id", session.user.id)
      .maybeSingle();
    const prior = (priorRow as { firm_url: string; account_type: ChallengeConfigRow["account_type"]; account_size: number | string; rules: ChallengeConfigRow["rules"] } | null) ?? null;

    // Reset the challenge clock whenever the firm, account type, or size changes (a genuinely
    // new challenge); an unchanged re-save keeps the original start so progress isn't wiped.
    const unchanged = Boolean(
      prior &&
        prior.firm_url === parsed.data.firmUrl &&
        prior.account_type === parsed.data.accountType &&
        Number(prior.account_size) === parsed.data.accountSize,
    );
    const startedAt = (unchanged && prior ? challengeStartedAt(prior.rules) : null) ?? new Date().toISOString();

    const extracted = reuseStoredRules(prior, parsed.data) ?? (await extractChallengeRules(parsed.data));
    const rules = { ...extracted, started_at: startedAt };
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
    if (error instanceof UnsafeUrlError) {
      return jsonApiError(400, "challenge_config_invalid", "That firm URL can’t be reached. Use the public website address.");
    }
    logger.error("Challenge config save failed.", { error: error instanceof Error ? error.message : "unknown" });
    return jsonApiError(500, "challenge_config_save_failed", "Could not save challenge mode.");
  }
}
