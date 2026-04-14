export const PRO_ACCESS_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"] as const;
export const MANAGEABLE_SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "incomplete",
  "unpaid",
  "paused",
];

const PRO_ACCESS_STATUSES = new Set<string>(PRO_ACCESS_SUBSCRIPTION_STATUSES);
const MANAGEABLE_SUBSCRIPTION_STATUS_SET = new Set<string>(MANAGEABLE_SUBSCRIPTION_STATUSES);

export function billingStatusGrantsProAccess(status: string | null | undefined): boolean {
  if (!status) {
    return false;
  }

  return PRO_ACCESS_STATUSES.has(status);
}

export function canManageSubscription(status: string | null | undefined): boolean {
  if (!status) {
    return false;
  }

  return MANAGEABLE_SUBSCRIPTION_STATUS_SET.has(status);
}

export function getBillingStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "active":
      return "Active";
    case "trialing":
      return "Trialing";
    case "past_due":
      return "Past due";
    case "incomplete":
      return "Incomplete";
    case "unpaid":
      return "Unpaid";
    case "paused":
      return "Paused";
    case "canceled":
      return "Canceled";
    case "incomplete_expired":
      return "Incomplete expired";
    default:
      return "Free";
  }
}
