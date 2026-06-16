import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { jsonApiError, jsonUnauthorized } from "@/lib/http/json-response";
import { generateWeeklyInsight } from "@/lib/journal/ai";
import type { JournalEntryRow } from "@/lib/journal/contracts";

const PRIVATE_CACHE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

export async function GET() {
  const session = await getSessionUser();
  if (!session) return jsonUnauthorized("Sign in to load journal insights.");

  const { data: cached } = await session.supabase
    .from("journal_insights")
    .select("insight_text, generated_at")
    .eq("user_id", session.user.id)
    .order("generated_at", { ascending: false })
    .limit(1);
  const latest = Array.isArray(cached) ? cached[0] as { insight_text: string; generated_at: string } | undefined : undefined;
  if (latest && Date.now() - new Date(latest.generated_at).getTime() < 7 * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ insight: latest.insight_text, generatedAt: latest.generated_at }, { headers: PRIVATE_CACHE_HEADERS });
  }

  return NextResponse.json({ insight: null, generatedAt: null, status: "needs_generation" }, { headers: PRIVATE_CACHE_HEADERS });
}

export async function POST() {
  const session = await getSessionUser();
  if (!session) return jsonUnauthorized("Sign in to generate journal insights.");

  const { data: rows, error } = await session.supabase
    .from("journal_entries")
    .select("id, entry_date, mood, pnl_amount, pnl_currency, note, lesson, challenge_status_note, tags, created_at, updated_at")
    .eq("user_id", session.user.id)
    .order("entry_date", { ascending: false })
    .limit(30);
  if (error || !rows) return jsonApiError(500, "journal_insight_failed", "Could not load journal insight.");
  if (rows.length < 5) return NextResponse.json({ insight: "Add more sessions to unlock your AI insight.", generatedAt: null }, { headers: PRIVATE_CACHE_HEADERS });

  const insight = await generateWeeklyInsight(rows as JournalEntryRow[], session.user.email ?? "Trader");
  const { data } = await session.supabase
    .from("journal_insights")
    .insert({ user_id: session.user.id, insight_text: insight })
    .select("generated_at")
    .single();

  return NextResponse.json({ insight, generatedAt: (data as { generated_at?: string } | null)?.generated_at ?? new Date().toISOString() }, { headers: PRIVATE_CACHE_HEADERS });
}
