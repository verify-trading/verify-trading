import { formatBillingPlanLabel, type BillingPlanKey } from "@/lib/billing/config";
import { getSubscriptionEmailFromAddress } from "@/lib/email/config";
import { sendViaResend } from "@/lib/email/send-via-resend";
import { buildMarketingEmailHtml } from "@/lib/email/templates";
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
    "You just made a great decision.",
    "You are now part of a growing community of serious traders who have one thing in common: they verify before they risk.",
    "Here is what is waiting for you right now:",
    "The Ask tab: unlimited. No daily limit. Ask it anything, any time.",
    "Your morning brief: open the Intelligence tab before every session. Gold, Oil, EUR/USD, GBP/USD. Key levels and session bias every single morning.",
    "Full trade analysis: every setup scored against 25 professional rules. Not just a number. A full breakdown.",
    "The markets, the calendar, the community: all yours.",
    "We cannot wait to see you thrive on this platform. Hundreds of traders are already using verify.trading to make better decisions and we are just getting started.",
    "One thing to do today: book your free 20-minute welcome call with our Pro Trader. He will get you set up personally and make sure you are getting everything out of your Pro membership from day one.",
    "You belong here.",
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
