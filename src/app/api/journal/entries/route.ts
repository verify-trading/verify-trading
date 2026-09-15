import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  computeJournalAggregates,
  currencyTotals,
  journalEntriesQuerySchema,
  journalEntryCreateSchema,
  type JournalEntryCreateInput,
  journalEntryDeleteSchema,
  overheatLogCreateSchema,
  scopeToChallenge,
  toJournalEntry,
  type JournalEntryRow,
  type JournalSource,
} from "@/lib/journal/contracts";
import { hasAiConsent, AI_CONSENT_KEY } from "@/lib/ai/consent";
import { generateChallengeStatus, overheatTrigger } from "@/lib/journal/ai";
import { challengeStartedAt, type ChallengeConfigRow } from "@/lib/journal/challenge";
import { getSessionUser } from "@/lib/auth/session";
import { isOwnedTradingAccount, liveJournalScope, resolveDefaultManualAccount } from "@/lib/trading-accounts";
import { jsonApiError, jsonUnauthorized, PRIVATE_CACHE_HEADERS } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";

// Every column toJournalEntry reads, in one place: a column missing here (as `source` once
// was) silently starves every reader that needs it, with no type error to show for it.
const ENTRY_COLUMNS =
  "id, entry_date, mood, pnl_amount, pnl_currency, note, lesson, challenge_status_note, tags, trade_details, source, trading_account_id, created_at, updated_at";

export async function GET(request: Request) {
  const parsedQuery = journalEntriesQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  if (!parsedQuery.success) {
    return jsonApiError(400, "journal_entries_request_invalid", "The journal entries request is invalid.");
  }

  try {
    const session = await getSessionUser();
    if (!session) {
      return jsonUnauthorized("Sign in to load journal entries.");
    }

    // Same filter on the page and the aggregates, or the header sums days the calendar hides.
    const scope = parsedQuery.data.account === "all" ? null : await liveJournalScope(session.supabase, session.user.id);
    // Deleted days keep their row so the importer can't re-add them; they are gone as far as
    // everything above this line is concerned. Newest first (computeJournalAggregates expects it).
    const { supabase, user } = session;
    function history(columns: string) {
      let query = supabase
        .from("journal_entries")
        .select(columns)
        .eq("user_id", user.id)
        .is("deleted_at", null);
      if (scope) query = query.or(scope);
      return query
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
    }

    // The page is what the client renders; the aggregates read is a light, full-history scan
    // (minimal columns) so lifetime header metrics stay correct even when the trader has more
    // sessions than a single page holds. Fanned out in parallel.
    const [{ data, error }, { data: allRows, error: aggError }] = await Promise.all([
      history(ENTRY_COLUMNS).limit(parsedQuery.data.limit),
      // Without an explicit limit PostgREST silently caps at its default (~1000 rows). Raise it,
      // so if truncation ever occurs it's the OLDEST rows that get dropped.
      history("entry_date, pnl_amount, pnl_currency, lesson, trading_account_id").limit(5000),
    ]);

    if (error || !data || aggError || !allRows) {
      return jsonApiError(500, "journal_entries_unavailable", "Could not load journal entries right now.");
    }

    return NextResponse.json(
      {
        entries: (data as unknown as JournalEntryRow[]).map(toJournalEntry),
        aggregates: computeJournalAggregates(allRows as unknown as JournalEntryRow[]),
      },
      { headers: PRIVATE_CACHE_HEADERS },
    );
  } catch (error) {
    logger.error("Journal entries request failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return jsonApiError(500, "journal_entries_unavailable", "Could not load journal entries right now.");
  }
}


/**
 * Where a manual save lands. `id` set means "update this exact row"; `id` null means "insert,
 * owned by tradingAccountId".
 */
type SaveTarget = { id: string | null; tradingAccountId: string | null };

/**
 * A client that names its account gets the fast path: no read, and an exact conflict target, so
 * two saves racing each other still resolve in the database rather than in a read-then-write gap.
 *
 * A client that names none is an older build. Those cannot be refused — an app release reaches
 * everyone slowly — so the server looks for a row already on that date and keeps whatever account
 * it has. That is what preserves editing a broker-imported day to claim it: without it the save
 * would open a SECOND row for the date on the manual account and leave the imported one behind.
 */
async function resolveSaveAccount(
  supabase: SupabaseClient,
  userId: string,
  input: { entryDate: string; tradingAccountId?: string | null },
): Promise<SaveTarget> {
  if (input.tradingAccountId) return { id: null, tradingAccountId: input.tradingAccountId };

  const { data, error } = await supabase
    .from("journal_entries")
    .select("id, trading_account_id")
    .eq("user_id", userId)
    .eq("entry_date", input.entryDate)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`journal_entries lookup failed: ${error.message}`);

  const existing = data as { id: string; trading_account_id: string | null } | null;
  if (existing) return { id: existing.id, tradingAccountId: existing.trading_account_id };
  return { id: null, tradingAccountId: await resolveDefaultManualAccount(supabase, userId) };
}

function entryPayload(userId: string, input: JournalEntryCreateInput, tradingAccountId: string | null) {
  return {
    user_id: userId,
    trading_account_id: tradingAccountId,
    entry_date: input.entryDate,
    mood: input.mood,
    pnl_amount: input.pnlAmount ?? null,
    pnl_currency: input.pnlCurrency,
    note: input.note,
    lesson: input.lesson?.trim() || null,
    tags: input.tags,
    trade_details: input.tradeDetails ?? null,
    // A CSV import posts through this same route, so the only thing separating it from a day the
    // trader typed is the bare 'csv' tag the importer sends. Stamp that difference into the
    // column at write time: every reader then asks `source`, and a tag the client is free to drop
    // stops being what decides whether a day is the trader's own account of it (see isImportedRow).
    source: (input.tags.includes("csv") ? "csv" : "mobile") satisfies JournalSource,
    // Logging a day you previously deleted brings it back — and hands the date back to the
    // importer, which skips any date whose row is flagged deleted.
    deleted_at: null,
  };
}

/**
 * Addressed by ID when adopting an existing row, because after the uniqueness change a date no
 * longer identifies one record and a date-keyed write could land on another account's day.
 */
function writeEntry(
  supabase: SupabaseClient,
  userId: string,
  input: JournalEntryCreateInput,
  target: SaveTarget,
) {
  const payload = entryPayload(userId, input, target.tradingAccountId);
  if (target.id) {
    return supabase
      .from("journal_entries")
      .update(payload)
      .eq("id", target.id)
      .eq("user_id", userId)
      .select(ENTRY_COLUMNS)
      .single();
  }
  return supabase
    .from("journal_entries")
    .upsert(payload, { onConflict: "user_id,trading_account_id,entry_date" })
    .select(ENTRY_COLUMNS)
    .single();
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonApiError(400, "journal_entry_invalid", "The journal entry request body is invalid.");
  }

  const parsedBody = journalEntryCreateSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonApiError(400, "journal_entry_invalid", "The journal entry request body is invalid.");
  }

  try {
    const session = await getSessionUser();
    if (!session) {
      return jsonUnauthorized("Sign in to save journal entries.");
    }

    const input = parsedBody.data;

    // Which account this day belongs to. A client that names one must own it; a client that
    // names none is an older build, and `resolveSaveAccount` keeps it working by adopting the
    // account of an existing row for that date, or falling back to the default manual account.
    if (input.tradingAccountId && !(await isOwnedTradingAccount(session.supabase, session.user.id, input.tradingAccountId))) {
      return jsonApiError(400, "journal_entry_account_invalid", "That trading account isn't available.");
    }
    const saveTarget = await resolveSaveAccount(session.supabase, session.user.id, input);

    const { data, error } = await writeEntry(session.supabase, session.user.id, input, saveTarget);

    if (error || !data) {
      return jsonApiError(500, "journal_entry_save_failed", "Could not save the journal entry right now.");
    }

    const entry = data as JournalEntryRow;
    const enriched = await enrichSavedEntry(session.supabase, session.user.id, entry);

    return NextResponse.json(
      { entry: toJournalEntry(enriched.entry), overheat: enriched.overheat },
      { status: 201, headers: PRIVATE_CACHE_HEADERS },
    );
  } catch (error) {
    logger.error("Journal entry save failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return jsonApiError(500, "journal_entry_save_failed", "Could not save the journal entry right now.");
  }
}

export async function PUT(request: Request) {
  const parsedBody = overheatLogCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return jsonApiError(400, "overheat_log_invalid", "The overheat response is invalid.");
  }

  const session = await getSessionUser();
  if (!session) return jsonUnauthorized("Sign in to save overheat responses.");

  const { error } = await session.supabase.from("overheat_logs").insert({
    user_id: session.user.id,
    trigger_type: parsedBody.data.triggerType,
    trigger_value: parsedBody.data.triggerValue,
    user_response: parsedBody.data.userResponse,
  });

  if (error) return jsonApiError(500, "overheat_log_failed", "Could not save the overheat response.");
  return NextResponse.json({ ok: true }, { headers: PRIVATE_CACHE_HEADERS });
}


/** The row an older build would have been showing for a date: newest first, matching the list. */
async function newestEntryIdOn(
  supabase: SupabaseClient,
  userId: string,
  entryDate: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("id")
    .eq("user_id", userId)
    .eq("entry_date", entryDate)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`journal_entries delete lookup failed: ${error.message}`);
  return (data as { id: string } | null)?.id ?? null;
}

export async function DELETE(request: Request) {
  // Accept entryDate from a JSON body or a ?entryDate= query param.
  const url = new URL(request.url);
  const queryDate = url.searchParams.get("entryDate");
  const rawBody = queryDate
    ? null
    : ((await request.json().catch(() => null)) as { entryDate?: unknown; entryId?: unknown } | null);
  const bodyDate = rawBody?.entryDate;

  const queryId = url.searchParams.get("entryId");
  const bodyId = queryId ? null : (rawBody as { entryId?: unknown } | null)?.entryId;
  const parsedBody = journalEntryDeleteSchema.safeParse({
    entryDate: queryDate ?? bodyDate,
    ...(queryId ?? bodyId ? { entryId: queryId ?? bodyId } : {}),
  });
  if (!parsedBody.success) {
    return jsonApiError(400, "journal_entry_delete_invalid", "The journal entry delete request is invalid.");
  }

  try {
    const session = await getSessionUser();
    if (!session) {
      return jsonUnauthorized("Sign in to delete journal entries.");
    }

    // Soft delete. The broker importer decides insert-vs-update on whether a row exists for
    // the date, so removing the row told it the day had never been imported and the next
    // sync put it straight back — the dialog's "this can't be undone" was the opposite of
    // true. Keeping the row, hidden, is what makes the deletion stick. Saving the day again
    // clears the flag (see POST) so the date is never permanently spent.
    //
    // RLS (journal_entries_delete_own) scopes this to the caller; the user_id filter keeps
    // it explicit. Deleting a nonexistent entry is a no-op, so it's still ok:true.
    // Always resolves to ONE row. A client that knows the id says so; one that sends only a date
    // is an older build, and a date can now name several rows — deleting them all would take a
    // personal day and a challenge day together on the strength of a single tap. Older builds
    // render one row per date (the newest, matching the list order), so that is the row the tap
    // meant and the only one that may go.
    const entryId = parsedBody.data.entryId ?? (await newestEntryIdOn(session.supabase, session.user.id, parsedBody.data.entryDate));

    // Nothing stored for that date. Deleting a nonexistent entry has always been a no-op.
    if (!entryId) return NextResponse.json({ ok: true }, { headers: PRIVATE_CACHE_HEADERS });

    const { error } = await session.supabase
      .from("journal_entries")
      .update({ deleted_at: new Date().toISOString() })
      .eq("user_id", session.user.id)
      .eq("id", entryId);

    if (error) {
      return jsonApiError(500, "journal_entry_delete_failed", "Could not delete the journal entry right now.");
    }

    return NextResponse.json({ ok: true }, { headers: PRIVATE_CACHE_HEADERS });
  } catch (error) {
    logger.error("Journal entry delete failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return jsonApiError(500, "journal_entry_delete_failed", "Could not delete the journal entry right now.");
  }
}

async function enrichSavedEntry(supabase: SupabaseClient, userId: string, entry: JournalEntryRow) {
  // The recent-entries read and the challenge-config read are independent — fan them out.
  const [{ data: rows }, { data: configData }] = await Promise.all([
    supabase
      .from("journal_entries")
      .select(ENTRY_COLUMNS)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("entry_date", { ascending: false })
      // ponytail: 30 rows serves the overheat streak check and caps the challenge figure
      // below at the last 30 logged days. Raise it (full rows, on every save) only if a
      // challenge running longer than that needs an exact cumulative in the AI's sentence —
      // the app computes and renders the exact figures itself either way.
      .limit(30),
    supabase
      .from("challenge_config")
      .select("id, firm_name, firm_url, account_size, account_type, rules, trading_account_id, created_at, updated_at")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  const entries = (rows ?? []) as JournalEntryRow[];
  const overheat = overheatTrigger(entries);

  if (!configData || entry.pnl_amount === null) return { entry, overheat };

  // Apple 5.1.1(i): the coaching line sends the firm, its rules and the trader's P&L to a
  // third-party AI. Saving still succeeds — it just saves without the note, exactly as it
  // does when the provider is down.
  if (!(await hasAiConsent(supabase, userId, AI_CONSENT_KEY))) return { entry, overheat };

  // The entry is already saved; a failure here (LLM/provider) must not surface as a
  // failed save. Best-effort enrich, otherwise return the saved entry without the note.
  try {
    const config = configData as ChallengeConfigRow;
    // The prompt calls these "this evaluation", so they must mean it: only the days logged
    // since the challenge started, and only the ones that actually carry a P&L — a journaled
    // day with no trade on it is not a trading day the firm would count.
    // Same helper as the dashboard and the coach: the note must not describe a different set of
    // days than the figures beside it.
    const inChallenge = scopeToChallenge(entries, {
      startedAt: challengeStartedAt(config.rules),
      tradingAccountId: config.trading_account_id ?? null,
    })
      .filter((row) => row.pnl_amount !== null);
    const note = await generateChallengeStatus({
      config,
      entry,
      // One currency, not a blend — this figure goes into the coaching line written onto
      // the entry, where the trader reads it as their standing.
      cumulativePnl: currencyTotals(inChallenge).totalPnl,
      daysTraded: inChallenge.length,
    });
    const { data: updated } = await supabase
      .from("journal_entries")
      .update({ challenge_status_note: note })
      .eq("id", entry.id)
      .select(ENTRY_COLUMNS)
      .single();

    return { entry: (updated as JournalEntryRow | null) ?? entry, overheat };
  } catch (enrichError) {
    logger.warn("Journal challenge enrichment failed; returning saved entry without it.", {
      error: enrichError instanceof Error ? enrichError.message : "unknown",
    });
    return { entry, overheat };
  }
}
