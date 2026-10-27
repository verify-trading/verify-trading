import {
  getSignupEmailFromAddress,
  getSubscriptionEmailFromAddress,
  isEmailConfigured,
} from "@/lib/email/config";
import { renderLifecycleEmail } from "@/lib/email/lifecycle/emails";
import type { SendLifecycleEmailInput, SendLifecycleEmailResult } from "@/lib/email/lifecycle/types";
import { buildUnsubscribeUrl, canSignUnsubscribe } from "@/lib/email/lifecycle/unsubscribe";
import { logEmailError } from "@/lib/email/log-email-error";
import { sendViaResend, type EmailPayload } from "@/lib/email/send-via-resend";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type Claim = {
  id: string;
  payload: EmailPayload;
  status: "sending" | "sent" | "blocked";
  first_attempt_at: string;
  processing_started_at: string;
};

/** A five-minute lease recovers interrupted sends; retries reuse the persisted Resend payload. */
export async function sendLifecycleEmail(input: SendLifecycleEmailInput): Promise<SendLifecycleEmailResult> {
  const supabase = getSupabaseAdminClient();
  if (!supabase || !isEmailConfigured()) {
    return "skipped";
  }

  const { userId, to, emailId, dedupeKey, kind, variant, vars } = input;
  const context = { userId, emailId, dedupeKey };

  let claim: Claim;
  try {
    // Marketing email must carry a signed unsubscribe link; account email (C5) goes out without one.
    const unsubscribeUrl = canSignUnsubscribe() ? buildUnsubscribeUrl(userId) : null;
    if (!unsubscribeUrl && kind === "marketing") {
      throw new Error("CRON_SECRET is not set; cannot sign the unsubscribe link for marketing email.");
    }
    const email = renderLifecycleEmail(emailId, vars, unsubscribeUrl);
    const payload: EmailPayload = {
      from: email.sender === "pro" ? getSubscriptionEmailFromAddress() : getSignupEmailFromAddress(),
      to,
      subject: email.subject,
      text: email.text,
      html: email.html,
      headers: unsubscribeUrl
        ? {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          }
        : undefined,
      idempotencyKey: `${userId}:${dedupeKey}`,
    };
    const { data, error } = await supabase.rpc("claim_lifecycle_email", {
      p_user_id: userId,
      p_email_id: emailId,
      p_dedupe_key: dedupeKey,
      p_kind: kind,
      p_variant: variant,
      p_payload: payload,
    });
    if (error) throw error;
    const row = (data as Claim[] | null)?.[0];
    if (!row) return "skipped"; // A live lease or changed recipient eligibility prevents sending.
    if (row.status === "sent") return "duplicate";
    if (row.status === "blocked") {
      logEmailError("Lifecycle email needs Resend dashboard reconciliation.", context, "Idempotency retry window expired.");
      return "skipped";
    }
    claim = row;
  } catch (error) {
    logEmailError("Failed to prepare lifecycle email send.", context, error);
    return "failed";
  }

  let resendId: string;
  try {
    const id = await sendViaResend(claim.payload);
    if (!id) throw new Error("Resend returned no message id.");
    resendId = id;
  } catch (sendError) {
    logEmailError("Failed to send lifecycle email.", context, sendError);
    try {
      const statusCode = (sendError as { statusCode?: number | null } | null)?.statusCode;
      const rejected = statusCode != null && statusCode >= 400 && statusCode < 500 && statusCode !== 408 && statusCode !== 409;
      // Only a definitively rejected first attempt may reset the idempotency window. An earlier
      // timeout or process crash might already have delivered the email.
      const firstAttemptAt = rejected && claim.first_attempt_at === claim.processing_started_at
        ? null
        : claim.first_attempt_at;
      const { error } = await supabase.from("email_sends")
        .update({ status: "pending", processing_started_at: null, first_attempt_at: firstAttemptAt })
        .eq("id", claim.id)
        .eq("processing_started_at", claim.processing_started_at);
      if (error) throw error;
    } catch (releaseError) {
      logEmailError("Failed to release lifecycle email lease.", { ...context, claimId: claim.id }, releaseError);
    }
    return "failed";
  }

  // If this write fails, a later run replays the saved request within Resend's idempotency window.
  try {
    const { error } = await supabase.from("email_sends")
      .update({ status: "sent", resend_id: resendId, sent_at: new Date().toISOString(), processing_started_at: null })
      .eq("id", claim.id)
      .eq("processing_started_at", claim.processing_started_at);
    if (error) throw error;
  } catch (error) {
    logEmailError("Failed to store lifecycle email resend_id.", { ...context, resendId }, error);
    return "failed"; // Keep the subscription unstamped until the send log is repaired by replay.
  }
  return "sent";
}

