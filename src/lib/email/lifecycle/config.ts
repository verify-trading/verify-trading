import { classifyTopic } from "@/lib/email/lifecycle/topic";
import type { EmailKind, EmailVars, ScheduledEmailId, UserFacts } from "@/lib/email/lifecycle/types";
import { getTodayUtcDateString } from "@/lib/rate-limit/usage";

/** Anti-spam and Resend budget settings (docs/lifecycle-emails-spec.md §3, §4). */
export const POLICY = {
  /** Go-live: only users who signed up on/after this get lifecycle emails; earlier users never do. */
  startDate: "2026-10-15T00:00:00Z",
  minHoursBetween: 24,
  maxPer7Days: 4,
  maxUnanswered: 4,
  sendWindowUk: [8, 20],
  r3WindowUk: [9, 11],
  dailyBudget: 60,
  maxPerRun: 15,
  sendGapMs: 600,
} as const;

export type SendWindow = "scheduled" | "immediate" | "r3";

export type EmailDefinition = {
  id: ScheduledEmailId;
  kind: EmailKind;
  /** Lower wins when several emails are due in the same run. */
  priority: number;
  enabled: boolean;
  window: SendWindow;
  /** Due window and the email's own once / cooldown / max-ever rules. Global caps live in pickEmail. */
  due: (facts: UserFacts, now: Date) => boolean;
  dedupeKey: (now: Date) => string;
  /** Template variables beyond firstName. */
  vars?: (facts: UserFacts, now: Date) => Partial<EmailVars>;
  /** Stored in email_sends.variant for reporting. */
  variant?: (vars: EmailVars) => string | null;
};

export const HOUR_MS = 3_600_000;

function hoursSince(date: Date | null, now: Date): number | null {
  return date ? (now.getTime() - date.getTime()) / HOUR_MS : null;
}

/** True when `date` is set and lies in [fromHours, toHours) before `now`. */
function hoursAgoIn(date: Date | null, now: Date, fromHours: number, toHours: number): boolean {
  const hours = hoursSince(date, now);
  return hours !== null && hours >= fromHours && hours < toHours;
}

function sendsOf(facts: UserFacts, emailId: ScheduledEmailId) {
  return facts.sends.filter((send) => send.emailId === emailId);
}

function neverSent(facts: UserFacts, emailId: ScheduledEmailId): boolean {
  return sendsOf(facts, emailId).length === 0;
}

function notSentWithinHours(facts: UserFacts, emailId: ScheduledEmailId, now: Date, hours: number): boolean {
  return sendsOf(facts, emailId).every((send) => (hoursSince(send.sentAt, now) ?? 0) >= hours);
}

function latestSentAt(facts: UserFacts, emailId: ScheduledEmailId): Date | null {
  const times = sendsOf(facts, emailId).map((send) => send.sentAt.getTime());
  return times.length > 0 ? new Date(Math.max(...times)) : null;
}

const isFree = (facts: UserFacts) => facts.tier === "free";
const once = (id: ScheduledEmailId) => () => id;
const daily = (id: ScheduledEmailId) => (now: Date) => `${id}:${getTodayUtcDateString(now)}`;
const topicVars = (facts: UserFacts) => ({ topic: classifyTopic(facts.firstQuestion) });

// One entry per email. To pause one: enabled: false. To retime one: edit its numbers.
export const EMAILS: EmailDefinition[] = [
  {
    id: "c3",
    kind: "marketing",
    priority: 10,
    enabled: true,
    window: "immediate",
    due: (f, now) =>
      isFree(f) &&
      f.cappedToday &&
      !neverSent(f, "c2") &&
      sendsOf(f, "c3").length < 2 &&
      notSentWithinHours(f, "c3", now, 14 * 24),
    dedupeKey: daily("c3"),
  },
  {
    id: "c1",
    kind: "marketing",
    priority: 20,
    enabled: true,
    window: "immediate",
    due: (f) => isFree(f) && f.cappedToday && neverSent(f, "c1"),
    dedupeKey: once("c1"),
  },
  {
    id: "c6",
    kind: "marketing",
    priority: 30,
    enabled: true,
    window: "immediate",
    due: (f, now) =>
      isFree(f) && hoursAgoIn(f.checkoutStartedAt, now, 1, 24) && notSentWithinHours(f, "c6", now, 14 * 24),
    dedupeKey: daily("c6"),
    vars: (f) => ({ plan: f.checkoutPlan ?? "monthly" }),
  },
  {
    id: "e2a",
    kind: "marketing",
    priority: 40,
    enabled: true,
    window: "scheduled",
    due: (f, now) => isFree(f) && f.activeDays === 0 && hoursAgoIn(f.signupAt, now, 24, 48) && neverSent(f, "e2a"),
    dedupeKey: once("e2a"),
  },
  {
    id: "e3a",
    kind: "marketing",
    priority: 41,
    enabled: true,
    window: "scheduled",
    due: (f, now) => isFree(f) && f.activeDays === 0 && hoursAgoIn(f.signupAt, now, 72, 120) && neverSent(f, "e3a"),
    dedupeKey: once("e3a"),
  },
  {
    id: "e2b",
    kind: "marketing",
    priority: 42,
    enabled: true,
    window: "scheduled",
    // 24–48h so "Yesterday you asked…" stays true.
    due: (f, now) => isFree(f) && f.activeDays === 1 && hoursAgoIn(f.firstActiveAt, now, 24, 48) && neverSent(f, "e2b"),
    dedupeKey: once("e2b"),
    vars: topicVars,
    variant: (vars) => vars.topic ?? null,
  },
  {
    id: "e3b",
    kind: "marketing",
    priority: 43,
    enabled: true,
    window: "scheduled",
    due: (f, now) => isFree(f) && f.activeDays === 1 && hoursAgoIn(f.firstActiveAt, now, 96, 168) && neverSent(f, "e3b"),
    dedupeKey: once("e3b"),
  },
  {
    id: "c2",
    kind: "marketing",
    priority: 50,
    enabled: true,
    window: "scheduled",
    due: (f, now) => isFree(f) && hoursAgoIn(latestSentAt(f, "c1"), now, 48, 120) && neverSent(f, "c2"),
    dedupeKey: once("c2"),
    vars: topicVars,
  },
  {
    id: "c4",
    kind: "marketing",
    priority: 55,
    enabled: true,
    window: "scheduled",
    due: (f, now) => f.tier === "pro" && hoursAgoIn(f.proSince, now, 72, 168) && neverSent(f, "c4"),
    dedupeKey: once("c4"),
  },
  {
    id: "r2",
    kind: "marketing",
    priority: 60,
    enabled: true,
    window: "scheduled",
    due: (f, now) => f.activeDays >= 3 && hoursAgoIn(f.thirdActiveAt, now, 0, 72) && neverSent(f, "r2"),
    dedupeKey: once("r2"),
  },
  {
    id: "r1",
    kind: "marketing",
    priority: 70,
    enabled: true,
    window: "scheduled",
    due: (f, now) =>
      f.activeDays >= 2 &&
      hoursAgoIn(f.lastActiveAt, now, 14 * 24, 21 * 24) &&
      notSentWithinHours(f, "r1", now, 60 * 24),
    dedupeKey: daily("r1"),
    vars: (f, now) => {
      const hours = hoursSince(f.lastActiveAt, now);
      return hours === null ? {} : { daysSince: Math.floor(hours / 24) };
    },
  },
  {
    id: "r3",
    kind: "marketing",
    priority: 80,
    enabled: true,
    window: "r3",
    due: (f, now) =>
      ((f.tier === "pro" && hoursAgoIn(f.proSince, now, 30 * 24, Infinity)) || f.activeDays >= 5) &&
      neverSent(f, "r3"),
    dedupeKey: once("r3"),
  },
];
