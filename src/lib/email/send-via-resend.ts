import { getResendClient } from "@/lib/email/client";

type SendViaResendInput = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
};

export async function sendViaResend({ from, to, subject, text, html }: SendViaResendInput): Promise<void> {
  const resend = getResendClient();
  if (!resend) {
    throw new Error("Transactional email is not configured.");
  }

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    text,
    html,
  });

  if (error) {
    throw new Error(error.message);
  }
}
