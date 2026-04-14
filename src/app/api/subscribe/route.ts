import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; source?: string };
    const email = body.email?.trim().toLowerCase();
    const source = body.source?.trim() || "landing_guide";

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      console.error("[subscribe] Supabase admin client unavailable.");
      return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
    }

    const { error } = await supabase.from("email_subscribers").upsert(
      { email, source, subscribed: true, updated_at: new Date().toISOString() },
      { onConflict: "email,source" },
    );

    if (error) {
      console.error("[subscribe] Supabase insert error:", error.message);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
