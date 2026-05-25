import { PRO_DAILY_ASK_LIMIT } from "@/lib/rate-limit/usage";

/**
 * Pro plan feature bullets — single source for pricing and in-app paywalls.
 * Update here when the Pro card on the landing / pricing page changes.
 */
export const PRO_PLAN_FEATURES = [
  `${PRO_DAILY_ASK_LIMIT} Ask chats per day`,
  "Live Markets Analysis",
  "Members Only Community",
  "Priority support",
  "Future features",
] as const;
