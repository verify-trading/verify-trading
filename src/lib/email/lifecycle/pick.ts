import { BILLING_PLAN_KEYS } from "@/lib/billing/config";
import { EMAILS, HOUR_MS, POLICY, type SendWindow } from "@/lib/email/lifecycle/config";
import { firstNameFrom } from "@/lib/email/lifecycle/topic";
import type { CheckoutPlan, EmailVars, PickedEmail, UserFacts, UserFactsRow } from "@/lib/email/lifecycle/types";

export { classifyTopic, firstNameFrom } from "@/lib/email/lifecycle/topic";

const DAY_MS = 24 * HOUR_MS;
const CHECKOUT_PLANS: readonly string[] = BILLING_PLAN_KEYS;

function parseDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

export function factsFromRow(row: UserFactsRow): UserFacts {
  return {
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    tier: row.tier === "pro" ? "pro" : "free",
    signupAt: new Date(row.signup_at),
    emailOptOutAt: parseDate(row.email_opt_out_at),
    firstActiveAt: parseDate(row.first_active_at),
    lastActiveAt: parseDate(row.last_active_at),
    activeDays: row.active_days,
    thirdActiveAt: parseDate(row.third_active_at),
    cappedToday: row.capped_today,
    firstQuestion: row.first_question,
    proSince: parseDate(row.pro_since),
    checkoutStartedAt: parseDate(row.checkout_started_at),
    checkoutPlan: CHECKOUT_PLANS.includes(row.checkout_plan ?? "") ? (row.checkout_plan as CheckoutPlan) : null,
    sends: (row.sends ?? []).map((send) => ({
      emailId: send.email_id,
      kind: send.kind === "transactional" ? "transactional" : "marketing",
      sentAt: new Date(send.sent_at),
    })),
  };
}

const londonHour = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hour: "numeric",
  hourCycle: "h23",
});

export function isInsideSendWindow(window: SendWindow, now: Date): boolean {
  if (window === "immediate") return true;
  const hour = Number(londonHour.formatToParts(now).find((part) => part.type === "hour")?.value);
  const [from, to] = window === "r3" ? POLICY.r3WindowUk : POLICY.sendWindowUk;
  return hour >= from && hour < to;
}

/** Global caps from spec §3. Any send (incl. transactional) counts toward the 24h gap. */
function isCapped(facts: UserFacts, now: Date): boolean {
  const t = now.getTime();
  const marketing = facts.sends.filter((send) => send.kind === "marketing");
  const lastAnswer = (facts.lastActiveAt ?? facts.signupAt).getTime();

  return (
    facts.sends.some((send) => send.sentAt.getTime() > t - POLICY.minHoursBetween * HOUR_MS) ||
    marketing.filter((send) => send.sentAt.getTime() > t - 7 * DAY_MS).length >= POLICY.maxPer7Days ||
    marketing.filter((send) => send.sentAt.getTime() > lastAnswer).length >= POLICY.maxUnanswered
  );
}

const BY_PRIORITY = [...EMAILS].sort((a, b) => a.priority - b.priority);

/** The one email due for this user right now, or null. Pure: reads only `facts` and `now`. */
export function pickEmail(facts: UserFacts, now: Date): PickedEmail | null {
  if (facts.emailOptOutAt || isCapped(facts, now)) return null;

  const email = BY_PRIORITY.find(
    (definition) =>
      definition.enabled && definition.due(facts, now) && isInsideSendWindow(definition.window, now),
  );
  if (!email) return null;

  const vars: EmailVars = { firstName: firstNameFrom(facts.displayName), ...email.vars?.(facts, now) };

  return {
    emailId: email.id,
    dedupeKey: email.dedupeKey(now),
    kind: email.kind,
    priority: email.priority,
    variant: email.variant?.(vars) ?? null,
    vars,
  };
}
