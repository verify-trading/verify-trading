import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { isOwnedTradingAccount } from "@/lib/trading-accounts";
import { AI_CONSENT_KEY, hasAiConsent } from "@/lib/ai/consent";
import { jsonApiError, jsonUnauthorized, PRIVATE_CACHE_HEADERS } from "@/lib/http/json-response";
import {
  challengeConfigSchema,
  challengeStartedAt,
  extractChallengeRules,
  reuseStoredRules,
  toChallengeConfig,
  type ChallengeConfigRow,
} from "@/lib/journal/challenge";
import { UnsafeUrlError } from "@/lib/http/safe-fetch";
import { logger } from "@/lib/observability/logger";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return jsonUnauthorized("Sign in to load challenge mode.");

  const { data, error } = await session.supabase
    .from("challenge_config")
    .select("id, firm_name, firm_url, account_size, account_type, rules, trading_account_id, created_at, updated_at")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) return jsonApiError(500, "challenge_config_unavailable", "Could not load challenge mode.");
  return NextResponse.json({ config: data ? toChallengeConfig(data as ChallengeConfigRow) : null }, { headers: PRIVATE_CACHE_HEADERS });
}

/**
 * Turning challenge mode off. The row IS the on/off state — there is no active flag — so off
 * means deleting it, and the trader sets a fresh challenge (and a fresh clock) to come back.
 *
 * Past `challenge_status_note`s on journal entries are deliberately left alone: they are what
 * the coach said on the day, the app only renders them beside a live config, and a moderation
 * report already filed against this config keeps its source_id as an orphan for the audit trail.
 */
export async function DELETE() {
  const session = await getSessionUser();
  if (!session) return jsonUnauthorized("Sign in to turn off challenge mode.");

  const { error } = await session.supabase
    .from("challenge_config")
    .delete()
    .eq("user_id", session.user.id);

  if (error) return jsonApiError(500, "challenge_config_delete_failed", "Could not turn off challenge mode.");
  // Same shape as GET, so the client can write the response straight into its cache.
  return NextResponse.json({ config: null }, { headers: PRIVATE_CACHE_HEADERS });
}

export async function POST(request: Request) {
  const parsed = challengeConfigSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonApiError(400, "challenge_config_invalid", "The challenge mode setup is invalid.");

  try {
    const session = await getSessionUser();
    if (!session) return jsonUnauthorized("Sign in to set up challenge mode.");

    if (parsed.data.tradingAccountId
      && !(await isOwnedTradingAccount(session.supabase, session.user.id, parsed.data.tradingAccountId))) {
      return jsonApiError(400, "challenge_config_account_invalid", "That trading account isn't available.");
    }

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

    const reusable = reuseStoredRules(prior, parsed.data);
    // Reusing stored percentage rules stays inside our database. A fresh extraction sends the
    // selected firm URL, account type and account size through Pikachu/Hueling AI to OpenAI.
    if (!reusable && !(await hasAiConsent(session.supabase, session.user.id, AI_CONSENT_KEY))) {
      return jsonApiError(403, "ai_consent_required", "Allow AI data sharing before reading challenge rules.");
    }
    const extracted = reusable ?? (await extractChallengeRules(parsed.data));
    const rules = { ...extracted, started_at: startedAt };
    const { data, error } = await session.supabase
      .from("challenge_config")
      .upsert({
        user_id: session.user.id,
        firm_name: rules.firm_name,
        firm_url: parsed.data.firmUrl,
        account_size: parsed.data.accountSize,
        account_type: parsed.data.accountType,
        // Undefined (an older client) leaves the stored value alone rather than clearing it: a
        // trader editing their account size from an old build must not silently un-scope a
        // challenge they had already attached to an account.
        ...(parsed.data.tradingAccountId === undefined ? {} : { trading_account_id: parsed.data.tradingAccountId }),
        rules,
      }, { onConflict: "user_id" })
      .select("id, firm_name, firm_url, account_size, account_type, rules, trading_account_id, created_at, updated_at")
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
