import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TERMS_VERSION = "1.0";

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    null
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      fullName?: string;
      email?: string;
      accountEmail?: string;
      termsVersion?: string;
    };

    const fullName = body.fullName?.trim();
    const email = body.email?.trim().toLowerCase();
    const accountEmail = body.accountEmail?.trim().toLowerCase() || null;
    const termsVersion = body.termsVersion?.trim() || TERMS_VERSION;

    if (!fullName) {
      return NextResponse.json(
        { error: "Please enter your full legal name." },
        { status: 400 },
      );
    }

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 },
      );
    }

    if (accountEmail && !EMAIL_REGEX.test(accountEmail)) {
      return NextResponse.json(
        { error: "Please enter a valid account email address." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      console.error("[affiliate-terms] Supabase admin client unavailable.");
      return NextResponse.json(
        { error: "Service temporarily unavailable." },
        { status: 503 },
      );
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("affiliate_terms_acceptances")
      .insert({
        full_name: fullName,
        email,
        account_email: accountEmail,
        terms_version: termsVersion,
        accepted_at: now,
        ip_address: getClientIp(request),
        user_agent: request.headers.get("user-agent"),
        referrer: request.headers.get("referer"),
      });

    if (error) {
      console.error("[affiliate-terms] Supabase insert error:", error.message);
      return NextResponse.json(
        { error: "Could not record acceptance. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, acceptedAt: now });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
