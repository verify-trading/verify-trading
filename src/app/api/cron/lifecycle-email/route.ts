import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { POLICY } from "@/lib/email/lifecycle/config";
import { factsFromRow, pickEmail } from "@/lib/email/lifecycle/pick";
import { sendLifecycleEmail } from "@/lib/email/lifecycle/send";
import type { SendLifecycleEmailResult, UserFactsRow } from "@/lib/email/lifecycle/types";
import { canSignUnsubscribe } from "@/lib/email/lifecycle/unsubscribe";
import { retrySubscriptionWelcomeEmails } from "@/lib/email/maybe-send-subscription-welcome";
import { readOptionalEnv } from "@/lib/env";
import { requireCronSecret } from "@/lib/http/cron-auth";
import { wait } from "@/lib/http/fetch-with-retry";
import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Lifecycle email cron (docs/lifecycle-emails-spec.md §7): every 15 minutes, pick at most one
 * due email per user and send them sequentially, within the daily Resend budget.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function readTestAllowlist(): Set<string> {
  const raw = readOptionalEnv("LIFECYCLE_EMAIL_TEST_TO") ?? "";
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** PostgREST caps every response (1000 rows on Supabase), so facts are read in pages. */
const FACTS_PAGE_SIZE = 1000;

async function loadFacts(supabase: SupabaseClient, since: Date): Promise<UserFactsRow[]> {
  const rows: UserFactsRow[] = [];
  for (let from = 0; ; from += FACTS_PAGE_SIZE) {
    const { data, error } = await supabase
      .rpc("lifecycle_user_facts", { p_since: since.toISOString() })
      // Optimisation only: pickEmail is the rule that skips opted-out users.
      .is("email_opt_out_at", null)
      .order("user_id")
      .range(from, from + FACTS_PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as UserFactsRow[];
    rows.push(...page);
    if (page.length < FACTS_PAGE_SIZE) return rows;
  }
}

function startOfUtcDay(now: Date): Date {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

function errorResponse(message: string, meta?: Record<string, unknown>) {
  logger.error("lifecycle email cron failed", { error: message, ...meta });
  return NextResponse.json({ ok: false, error: message }, { status: 500 });
}

export async function GET(request: Request) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  // Live for everyone who signed up after POLICY.startDate. LIFECYCLE_EMAIL_TEST_TO set: only
  // those addresses get mail (use it to test, or to pause sending).
  const allowlist = readTestAllowlist();
  const mode = allowlist.size > 0 ? "test" : "live";
  const start = new Date(POLICY.startDate);

  // Without it every marketing send fails after claiming; stop here instead of churning each run.
  if (!canSignUnsubscribe()) {
    return errorResponse("CRON_SECRET is not set, so unsubscribe links can't be signed.", { mode });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return errorResponse("Supabase admin client is not configured.", { mode });
  }

  try {
    // Transactional welcomes retry independently of the marketing budget and test allowlist.
    const welcomeRetries = await retrySubscriptionWelcomeEmails(POLICY.maxPerRun);
    const now = new Date();
    const { count, error: countError } = await supabase
      .from("email_sends")
      .select("id", { count: "exact", head: true })
      .or("status.in.(sent,sending,blocked),first_attempt_at.not.is.null")
      .gte("sent_at", startOfUtcDay(now).toISOString());
    if (countError) throw countError;

    const remaining = POLICY.dailyBudget - (count ?? 0);
    if (remaining <= 0) {
      logger.info("lifecycle email cron budget exhausted", { mode, sentToday: count });
      return NextResponse.json({ ok: true, mode, budgetExhausted: true, welcomeRetries });
    }

    let facts = (await loadFacts(supabase, start)).map(factsFromRow);
    if (mode === "test") {
      facts = facts.filter((f) => allowlist.has(f.email.trim().toLowerCase()));
    }

    const picks = facts
      .flatMap((f) => {
        const pick = pickEmail(f, now);
        return pick ? [{ f, pick }] : [];
      })
      .sort((a, b) => a.pick.priority - b.pick.priority)
      .slice(0, Math.min(POLICY.maxPerRun - welcomeRetries, remaining));

    const tally: Record<SendLifecycleEmailResult, number> = { sent: 0, duplicate: 0, failed: 0, skipped: 0 };
    for (const [index, { f, pick }] of picks.entries()) {
      if (index > 0 || welcomeRetries > 0) await wait(POLICY.sendGapMs);
      const result = await sendLifecycleEmail({
        userId: f.userId,
        to: f.email,
        emailId: pick.emailId,
        dedupeKey: pick.dedupeKey,
        kind: pick.kind,
        variant: pick.variant,
        vars: pick.vars,
      });
      tally[result] += 1;
    }

    const summary = { ok: true, mode, welcomeRetries, considered: facts.length, picked: picks.length, ...tally };
    logger.info("lifecycle email cron completed", summary);
    return NextResponse.json(summary);
  } catch (error) {
    // Supabase errors are plain objects with a message, not always Error instances.
    const message = (error as { message?: unknown } | null)?.message;
    return errorResponse(typeof message === "string" ? message : "Lifecycle email cron failed.", { mode });
  }
}
