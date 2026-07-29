import { Resend } from "resend";

import { getResendApiKey } from "@/lib/email/config";

let resendClient: Resend | null = null;

export function getResendClient(): Resend | null {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    return null;
  }

  resendClient ??= new Resend(apiKey);
  return resendClient;
}
