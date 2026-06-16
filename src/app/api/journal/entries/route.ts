import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  journalEntriesQuerySchema,
  journalEntryCreateSchema,
  overheatLogCreateSchema,
  toJournalEntry,
  type JournalEntryRow,
} from "@/lib/journal/contracts";
import { generateChallengeStatus, overheatTrigger } from "@/lib/journal/ai";
import type { ChallengeConfigRow } from "@/lib/journal/challenge";
import { getSessionUser } from "@/lib/auth/session";
import { jsonApiError, jsonUnauthorized } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";

const PRIVATE_CACHE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

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
      .select("id, entry_date, mood, pnl_amount, pnl_currency, note, lesson, challenge_status_note, tags, created_at, updated_at")
      .eq("user_id", session.user.id)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(parsedQuery.data.limit);

    if (parsedQuery.data.cursor) {
      query.lt("entry_date", parsedQuery.data.cursor);
    }

    const { data, error } = await query;

    if (error || !data) {
      return jsonApiError(500, "journal_entries_unavailable", "Could not load journal entries right now.");
    }

    return NextResponse.json(
      { entries: (data as JournalEntryRow[]).map(toJournalEntry) },
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
        source: "mobile",
      }, { onConflict: "user_id,entry_date" })
      .select("id, entry_date, mood, pnl_amount, pnl_currency, note, lesson, challenge_status_note, tags, created_at, updated_at")
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

async function enrichSavedEntry(supabase: SupabaseClient, userId: string, entry: JournalEntryRow) {
  const { data: rows } = await supabase
    .from("journal_entries")
    .select("id, entry_date, mood, pnl_amount, pnl_currency, note, lesson, challenge_status_note, tags, created_at, updated_at")
    .eq("user_id", userId)
    .order("entry_date", { ascending: false })
    .limit(30);
  const entries = (rows ?? []) as JournalEntryRow[];
  const overheat = overheatTrigger(entries);
  const { data: configData } = await supabase
    .from("challenge_config")
    .select("id, firm_name, firm_url, account_size, account_type, rules, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!configData || entry.pnl_amount === null) return { entry, overheat };

  const note = await generateChallengeStatus({
    config: configData as ChallengeConfigRow,
    entry,
    cumulativePnl: entries.reduce((sum, item) => sum + Number(item.pnl_amount ?? 0), 0),
    daysTraded: entries.length,
  });
  const { data: updated } = await supabase
    .from("journal_entries")
    .update({ challenge_status_note: note })
    .eq("id", entry.id)
    .select("id, entry_date, mood, pnl_amount, pnl_currency, note, lesson, challenge_status_note, tags, created_at, updated_at")
    .single();

  return { entry: (updated as JournalEntryRow | null) ?? entry, overheat };
}
