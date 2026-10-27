import type { BillingPlanKey } from "@/lib/billing/config";

/**
 * Shared contract for the lifecycle emails (docs/lifecycle-emails-spec.md).
 * Every module in src/lib/email/lifecycle/ builds against these types.
 */

/** Emails picked by the 15-minute job. E1 is the existing signup welcome; C5 is sent from the Stripe webhook. */
export type ScheduledEmailId =
  | "e2a"
  | "e3a"
  | "e2b"
  | "e3b"
  | "c1"
  | "c2"
  | "c3"
  | "c4"
  | "c6"
  | "r1"
  | "r2"
  | "r3";

/** Every email this module renders. */
export type LifecycleEmailId = ScheduledEmailId | "c5";

export type EmailKind = "transactional" | "marketing";

export type TopicBranch = "propfirm" | "broker" | "risk" | "psychology" | "market" | "other";

export type CheckoutPlan = BillingPlanKey;

/** One row already written to public.email_sends. */
export type EmailSendRecord = {
  emailId: string;
  kind: EmailKind;
  sentAt: Date;
};

/** One row of public.lifecycle_user_facts(p_since), camelCased, with timestamps parsed. */
export type UserFacts = {
  userId: string;
  email: string;
  displayName: string | null;
  tier: "free" | "pro";
  signupAt: Date;
  emailOptOutAt: Date | null;
  firstActiveAt: Date | null;
  lastActiveAt: Date | null;
  activeDays: number;
  thirdActiveAt: Date | null;
  cappedToday: boolean;
  firstQuestion: string | null;
  proSince: Date | null;
  checkoutStartedAt: Date | null;
  checkoutPlan: CheckoutPlan | null;
  sends: EmailSendRecord[];
};

/** Raw row as returned by supabase.rpc("lifecycle_user_facts"). */
export type UserFactsRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  tier: string;
  signup_at: string;
  email_opt_out_at: string | null;
  first_active_at: string | null;
  last_active_at: string | null;
  active_days: number;
  third_active_at: string | null;
  capped_today: boolean;
  first_question: string | null;
  pro_since: string | null;
  checkout_started_at: string | null;
  checkout_plan: string | null;
  sends: Array<{ email_id: string; dedupe_key: string; kind: string; sent_at: string }> | null;
};

/** Variables an email template may use. Each email reads only the ones it needs. */
export type EmailVars = {
  firstName: string;
  topic?: TopicBranch;
  /** R1: whole days since the user's last activity. */
  daysSince?: number;
  /** C6: plan the user started checking out. */
  plan?: CheckoutPlan;
};

/** What pickEmail() returns for a user who is due an email. */
export type PickedEmail = {
  emailId: ScheduledEmailId;
  dedupeKey: string;
  kind: EmailKind;
  priority: number;
  /** Stored in email_sends.variant for reporting (E2B: its topic branch). */
  variant: string | null;
  vars: EmailVars;
};

export type RenderedEmail = {
  subject: string;
  /** Which from-address sends it: "pro" for subscriber emails, "ai" for the rest. */
  sender: "pro" | "ai";
  html: string;
  text: string;
};

export type SendLifecycleEmailInput = {
  userId: string;
  to: string;
  emailId: LifecycleEmailId;
  dedupeKey: string;
  kind: EmailKind;
  variant: string | null;
  vars: EmailVars;
};

/** duplicate = completed send; skipped includes a live lease, blocked replay, or ineligible recipient. */
export type SendLifecycleEmailResult = "sent" | "duplicate" | "failed" | "skipped";

