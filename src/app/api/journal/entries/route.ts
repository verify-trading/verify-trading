import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  computeJournalAggregates,
  currencyTotals,
  journalEntriesQuerySchema,
  journalEntryCreateSchema,
  journalEntryDeleteSchema,
  overheatLogCreateSchema,
  scopeToChallengeStart,
  toJournalEntry,
  type JournalEntryRow,
  type JournalSource,
} from "@/lib/journal/contracts";
import { generateChallengeStatus, overheatTrigger } from "@/lib/journal/ai";
import { challengeStartedAt, type ChallengeConfigRow } from "@/lib/journal/challenge";
import { getSessionUser } from "@/lib/auth/session";
import { jsonApiError, jsonUnauthorized, PRIVATE_CACHE_HEADERS } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";

// Every column toJournalEntry reads, in one place: a column missing here (as `source` once
// was) silently starves every reader that needs it, with no type error to show for it.
const ENTRY_COLUMNS =
  "id, entry_date, mood, pnl_amount, pnl_currency, note, lesson, challenge_status_note, tags, trade_details, source, created_at, updated_at";

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

    const query = session.supabase
      .from("journal_entries")
      .select(ENTRY_COLUMNS)
      .eq("user_id", session.user.id)
      // Deleted days keep their row so the importer can't re-add them; they are gone as far
      // as everything above this line is concerned.
      .is("deleted_at", null)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(parsedQuery.data.limit);

    // The page (above) is what the client renders; the aggregates read is a light,
    // full-history scan (minimal columns) so lifetime header metrics stay correct even
    // when the trader has more sessions than a single page holds. Fanned out in parallel.
    const [{ data, error }, { data: allRows, error: aggError }] = await Promise.all([
      query,
      session.supabase
        .from("journal_entries")
        .select("entry_date, pnl_amount, pnl_currency, lesson")
        .eq("user_id", session.user.id)
        .is("deleted_at", null)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        // Without an explicit limit, PostgREST silently caps this at its default
        // (~1000 rows). Raise the cap and keep newest-first ordering (computeJournalAggregates
        // expects that) so if truncation ever occurs it's the OLDEST rows that get dropped.
        .limit(5000),
    ]);

    if (error || !data || aggError || !allRows) {
      return jsonApiError(500, "journal_entries_unavailable", "Could not load journal entries right now.");
    }

    return NextResponse.json(
      {
        entries: (data as JournalEntryRow[]).map(toJournalEntry),
        aggregates: computeJournalAggregates(allRows as JournalEntryRow[]),
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
    const { data, error } = await session.supabase
      .from("journal_entries")
      .upsert({
        user_id: session.user.id,
        entry_date: input.entryDate,
        mood: input.mood,
        pnl_amount: input.pnlAmount ?? null,
        pnl_currency: input.pnlCurrency,
        note: input.note,
        lesson: input.lesson?.trim() || null,
        tags: input.tags,
        trade_details: input.tradeDetails ?? null,
        source: "mobile" satisfies JournalSource,
        // Logging a day you previously deleted brings it back — and hands the date back to
        // the importer, which skips any date whose row is flagged deleted.
        deleted_at: null,
      }, { onConflict: "user_id,entry_date" })
      .select(ENTRY_COLUMNS)
      .single();

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

export async function DELETE(request: Request) {
  // Accept entryDate from a JSON body or a ?entryDate= query param.
  const url = new URL(request.url);
  const queryDate = url.searchParams.get("entryDate");
  const bodyDate = queryDate
    ? null
    : ((await request.json().catch(() => null)) as { entryDate?: unknown } | null)?.entryDate;

  const parsedBody = journalEntryDeleteSchema.safeParse({ entryDate: queryDate ?? bodyDate });
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
    const { error } = await session.supabase
      .from("journal_entries")
      .update({ deleted_at: new Date().toISOString() })
      .eq("user_id", session.user.id)
      .eq("entry_date", parsedBody.data.entryDate);

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
      .select("id, firm_name, firm_url, account_size, account_type, rules, created_at, updated_at")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  const entries = (rows ?? []) as JournalEntryRow[];
  const overheat = overheatTrigger(entries);

  if (!configData || entry.pnl_amount === null) return { entry, overheat };

  // The entry is already saved; a failure here (LLM/provider) must not surface as a
  // failed save. Best-effort enrich, otherwise return the saved entry without the note.
  try {
    const config = configData as ChallengeConfigRow;
    // The prompt calls these "this evaluation", so they must mean it: only the days logged
    // since the challenge started, and only the ones that actually carry a P&L — a journaled
    // day with no trade on it is not a trading day the firm would count.
    const inChallenge = scopeToChallengeStart(entries, challengeStartedAt(config.rules))
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
