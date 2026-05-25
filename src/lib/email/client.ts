import { Resend } from "resend";

import { getResendApiKey } from "@/lib/email/config";

let resendClient: Resend | null | undefined;

export function getResendClient(): Resend | null {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    return null;
  }

  if (resendClient === undefined) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}
