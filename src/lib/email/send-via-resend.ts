import { getResendClient } from "@/lib/email/client";

export type EmailPayload = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
  /** Resend drops a repeat send with the same key for 24h. */
  idempotencyKey?: string;
};

/** Sends one email and returns the Resend message id. Throws on any Resend error. */
export async function sendViaResend({
  from,
  to,
  subject,
  text,
  html,
  headers,
  idempotencyKey,
}: EmailPayload): Promise<string | null> {
  const resend = getResendClient();
  if (!resend) {
    throw new Error("Transactional email is not configured.");
  }

  const { data, error } = await resend.emails.send(
    {
      from,
      to,
      subject,
      text,
      html,
      headers,
    },
    idempotencyKey ? { idempotencyKey } : undefined,
  );

  if (error) {
    throw Object.assign(new Error(error.message), { statusCode: error.statusCode });
  }

  return data?.id ?? null;
}
