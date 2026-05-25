import { getSignupEmailFromAddress } from "@/lib/email/config";
import { sendViaResend } from "@/lib/email/send-via-resend";
import { buildMarketingEmailHtml } from "@/lib/email/templates";
import { PRO_DAILY_ASK_LIMIT } from "@/lib/rate-limit/usage";
import { getAppName } from "@/lib/site-config";

type EmailPayload = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
};

type SendSignupWelcomeEmailInput = {
  email: string;
  displayName?: string | null;
  appOrigin: string;
};

export function buildSignupWelcomeEmail({
  email,
  displayName,
  appOrigin,
}: SendSignupWelcomeEmailInput): EmailPayload {
  const appName = getAppName();
  const normalizedAppOrigin = appOrigin.replace(/\/$/, "");
  const greetingName = displayName?.trim() || "there";
  const askUrl = `${normalizedAppOrigin}/ask`;
  const paragraphs = [
    `Hi ${greetingName},`,
    `Welcome to ${appName}.`,
    "Most traders lose because they trade blind. They trust signals, brokers, screenshots and gut feeling without a second opinion.",
    `${appName} gives you that second opinion in seconds.`,
    "Start with the Ask tab. Drop in a trade idea, broker name, signal group or market question and get a clear answer before you risk money.",
    "Use it before your next decision.",
    "Welcome to the team.",
  ];

  return {
    from: getSignupEmailFromAddress(),
    to: email,
    subject: `Welcome to ${appName}`,
    text: [
      ...paragraphs,
      "",
      "Open the Ask tab:",
      askUrl,
      "",
      `Pro gives you ${PRO_DAILY_ASK_LIMIT} Ask chats per day when you are ready to upgrade.`,
      "",
      `- The ${appName} team`,
    ].join("\n"),
    html: buildMarketingEmailHtml({
      appName,
      appOrigin,
      title: `Welcome to ${appName}`,
      preview: "Your professional second opinion is ready.",
      paragraphs,
      button: {
        href: askUrl,
        label: "Open Ask",
      },
      footer: `Pro gives you ${PRO_DAILY_ASK_LIMIT} Ask chats per day when you are ready to upgrade.`,
    }),
  };
}

export async function sendSignupWelcomeEmail(input: SendSignupWelcomeEmailInput): Promise<void> {
  await sendViaResend(buildSignupWelcomeEmail(input));
}
