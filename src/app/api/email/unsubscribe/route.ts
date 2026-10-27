import { brandColors } from "@/lib/brand";
import { escapeHtml } from "@/lib/email/escape-html";
import { verifyUnsubscribeToken } from "@/lib/email/lifecycle/unsubscribe";
import { logger } from "@/lib/observability/logger";
import { getAppName, getSiteUrl } from "@/lib/site-config";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCOUNT_LINE = "You'll still get emails about your account and billing.";

type Page = {
  status: number;
  heading: string;
  lines?: string[];
  /** Renders a POST form back to this URL with this button label. */
  form?: { action: string; button: string; resubscribe?: boolean };
};

function renderPage({ status, heading, lines = [], form }: Page): Response {
  const body = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
  const formHtml = form
    ? `<form method="post" action="${escapeHtml(form.action)}">${
        form.resubscribe ? '<input type="hidden" name="action" value="resubscribe">' : ""
      }<button type="submit">${escapeHtml(form.button)}</button></form>`
    : "";
  const appName = escapeHtml(getAppName());
  const siteUrl = escapeHtml(getSiteUrl());
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(heading)} · ${appName}</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:${brandColors.navy};color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;padding:16px;box-sizing:border-box}
main{background:${brandColors.card};border-radius:16px;padding:32px 24px;max-width:440px;width:100%;text-align:center}
.brand{font-weight:700;letter-spacing:.02em;margin:0 0 24px;color:#fff;text-decoration:none;display:inline-block}
h1{font-size:22px;margin:0 0 12px}
p{color:rgba(255,255,255,.75);line-height:1.5;margin:0 0 12px}
form{margin:24px 0 0}
button{background:${brandColors.coral};color:#fff;border:0;border-radius:999px;padding:12px 28px;font-size:16px;font-weight:600;cursor:pointer}
.back{display:inline-block;margin-top:24px;color:rgba(255,255,255,.6);font-size:14px}
</style>
</head>
<body>
<main>
<a class="brand" href="${siteUrl}">${appName}</a>
<h1>${escapeHtml(heading)}</h1>
${body}${formHtml}
<a class="back" href="${siteUrl}">Back to ${appName}</a>
</main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex",
      "Cache-Control": "no-store",
    },
  });
}

const invalidPage = () => renderPage({ status: 400, heading: "This link isn't valid." });
const errorPage = () => renderPage({ status: 500, heading: "Something went wrong. Please try again." });

function adminClient() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    logger.error("unsubscribe: Supabase admin client is not configured");
  }
  return supabase;
}

/** The verified user id plus the form action for this exact link, or null when the link is bad. */
function readLink(request: Request): { userId: string; action: string } | null {
  const url = new URL(request.url);
  const userId = url.searchParams.get("u") ?? "";
  const token = url.searchParams.get("t") ?? "";
  if (!verifyUnsubscribeToken(userId, token)) {
    return null;
  }
  return { userId, action: `${url.pathname}?${new URLSearchParams({ u: userId, t: token })}` };
}

// GET never writes: mail scanners prefetch links, so it only shows a button that POSTs.
export async function GET(request: Request) {
  const link = readLink(request);
  if (!link) {
    return invalidPage();
  }

  const supabase = adminClient();
  if (!supabase) {
    return errorPage();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("email_opt_out_at")
    .eq("id", link.userId)
    .maybeSingle();
  if (error) {
    logger.error("unsubscribe: failed to read profile", { userId: link.userId, error: error.message });
    return errorPage();
  }
  if (!data) {
    return invalidPage();
  }

  if (data.email_opt_out_at) {
    return renderPage({
      status: 200,
      heading: "You're unsubscribed.",
      form: { action: link.action, button: "Resubscribe", resubscribe: true },
    });
  }
  return renderPage({
    status: 200,
    heading: `Unsubscribe from ${getAppName()} emails?`,
    lines: [ACCOUNT_LINE],
    form: { action: link.action, button: "Unsubscribe" },
  });
}

// Handles both RFC 8058 one-click (body "List-Unsubscribe=One-Click") and the page's own form.
export async function POST(request: Request) {
  const link = readLink(request);
  if (!link) {
    return invalidPage();
  }

  const form = new URLSearchParams(await request.text().catch(() => ""));
  const resubscribe = form.get("action") === "resubscribe";

  const supabase = adminClient();
  if (!supabase) {
    return errorPage();
  }

  const { error } = await supabase
    .from("profiles")
    .update({ email_opt_out_at: resubscribe ? null : new Date().toISOString() })
    .eq("id", link.userId);
  if (error) {
    logger.error("unsubscribe: failed to update profile", {
      userId: link.userId,
      resubscribe,
      error: error.message,
    });
    return errorPage();
  }

  if (resubscribe) {
    return renderPage({ status: 200, heading: "You're subscribed again." });
  }
  return renderPage({
    status: 200,
    heading: "You're unsubscribed.",
    lines: ["You won't get any more of these emails.", ACCOUNT_LINE],
  });
}
