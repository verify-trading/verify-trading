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
    "You have just found a tool a lot of traders who are done making decisions blind are now using.",
    "Traders are using verify.trading every single day: checking their brokers, scoring their trades, reading their morning brief before market open. And they are not going back to guessing.",
    "Now you are one of them.",
    "The Ask tab is open and waiting. Type in anything: your trade, your analysis, is your broker legit, is this trader's signal group real, what the markets are doing today.",
    "You will get a straight answer in seconds.",
    "This is your professional second opinion. The one every serious trader needs and most never had.",
    "We are genuinely excited to have you here.",
    "Start with this: open the Ask tab and type your first question. See what comes back.",
    "Welcome to the winning team!",
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
