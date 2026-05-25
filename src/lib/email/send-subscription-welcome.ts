import { formatBillingPlanLabel, type BillingPlanKey } from "@/lib/billing/config";
import { getSubscriptionEmailFromAddress } from "@/lib/email/config";
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

type SendSubscriptionWelcomeEmailInput = {
  email: string;
  displayName?: string | null;
  planKey: BillingPlanKey;
  appOrigin: string;
};

export function buildSubscriptionWelcomeEmail({
  email,
  displayName,
  planKey,
  appOrigin,
}: SendSubscriptionWelcomeEmailInput): EmailPayload {
  const appName = getAppName();
  const planLabel = formatBillingPlanLabel(planKey);
  const greetingName = displayName?.trim() || "there";
  const bookingUrl = "https://calendly.com/verifytrading/-";
  const paragraphs = [
    `Hi ${greetingName},`,
    `Welcome to ${appName} Pro.`,
    "You now have the full toolkit serious traders use to verify before they risk.",
    `Ask gives you ${PRO_DAILY_ASK_LIMIT} chats per day for trades, brokers, signals and market questions.`,
    "Your morning brief helps you prepare before the session. Trade analysis scores your setup against 25 professional rules and shows what needs fixing.",
    "Book your free 20-minute welcome call below. We will help you get set up and make sure Pro fits into your trading routine from day one.",
    "Welcome to Pro. You belong here.",
  ];

  return {
    from: getSubscriptionEmailFromAddress(),
    to: email,
    subject: `Your ${appName} ${planLabel} subscription is active`,
    text: [
      ...paragraphs,
      "",
      "Book your call with the Pro Trader:",
      bookingUrl,
      "",
      `- The ${appName} team`,
    ].join("\n"),
    html: buildMarketingEmailHtml({
      appName,
      appOrigin,
      title: `Welcome to ${appName} Pro`,
      preview: "Your Pro access is active now.",
      paragraphs,
      button: {
        href: bookingUrl,
        label: "Book your call with the Pro Trader",
      },
      footer: `${planLabel} is active. You can manage billing from your account any time.`,
    }),
  };
}

export async function sendSubscriptionWelcomeEmail(input: SendSubscriptionWelcomeEmailInput): Promise<void> {
  await sendViaResend(buildSubscriptionWelcomeEmail(input));
}
