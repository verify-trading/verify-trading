import Link from "next/link";
import { ArrowLeft, CreditCard } from "lucide-react";

import {
  BillingActionButton,
  BillingCheckoutSync,
} from "@/components/billing/billing-actions";
import { getBillingStatusLabel } from "@/lib/billing/subscription-status";
import { FREE_DAILY_ASK_LIMIT, type FreeAskUsageSummary } from "@/lib/rate-limit/usage";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BillingSubscriptionRow = {
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  currency: string | null;
  unit_amount: number | null;
  interval: string | null;
  interval_count: number | null;
};

type BillingPageViewProps = {
  customerName: string;
  currentPlanLabel: string;
  canOpenPortal: boolean;
  isCanceling: boolean;
  renewalDate: string | null;
  recurringAmount: string | null;
  subscription: BillingSubscriptionRow | null;
  /** Present when the user is on the free tier without an active Stripe subscription row. */
  freeAskUsage: FreeAskUsageSummary | null;
  checkoutState: string | null;
  checkoutSessionId: string | null;
};

function subscriptionStatusPillClass(status: string | null | undefined) {
  switch (status) {
    case "active":
    case "trialing":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
    case "past_due":
    case "unpaid":
      return "border-amber-400/30 bg-amber-500/10 text-amber-100";
    case "canceled":
    case "incomplete_expired":
      return "border-white/15 bg-white/[0.06] text-slate-300";
    default:
      return "border-[rgba(76,110,245,0.28)] bg-[rgba(76,110,245,0.12)] text-[var(--vt-blue)]";
  }
}

export function BillingPageView({
  customerName,
  currentPlanLabel,
  canOpenPortal,
  isCanceling,
  renewalDate,
  recurringAmount,
  subscription,
  freeAskUsage,
  checkoutState,
  checkoutSessionId,
}: BillingPageViewProps) {
  const periodEndLabel = isCanceling ? "Ends on" : "Renews on";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(242,109,109,0.12),transparent_50%),var(--vt-navy)] text-white">
      <BillingCheckoutSync checkoutState={checkoutState} checkoutSessionId={checkoutSessionId} />

      <div className="mx-auto max-w-5xl px-4 pb-[max(7rem,calc(env(safe-area-inset-bottom,0px)+2rem))] pt-8 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-10">
            <Link
              href="/ask"
              className="mb-6 inline-flex items-center gap-2 text-sm text-white/50 transition hover:text-white"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Back
            </Link>
            <h1 className="font-black tracking-[-0.05em] text-white text-3xl sm:text-4xl">Billing</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--vt-muted)]">
              {canOpenPortal
                ? `${customerName} — manage your subscription and billing.`
                : `${customerName} — you’re on ${currentPlanLabel}.`}
            </p>
          </div>

          {!canOpenPortal ? (
            freeAskUsage ? (
              <div className="w-full space-y-6">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--vt-coral)]">
                    Current plan
                  </p>
                  <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-200">
                    Free
                  </span>
                </div>
                <p className="mt-3 text-lg font-semibold tracking-[-0.02em] text-white sm:text-xl">Free</p>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--vt-muted)]">
                  {FREE_DAILY_ASK_LIMIT} Ask messages per day, full access to core tools. Upgrade for unlimited Ask and
                  Stripe-managed billing.
                </p>
              </div>

              <div className="rounded-2xl border border-[color:var(--vt-border)] bg-white/[0.04] p-6 sm:p-8">
                <div className="flex items-center justify-between gap-3 text-sm font-semibold text-white">
                  <span>Daily Ask usage</span>
                  <span className="tabular-nums">
                    {freeAskUsage.used}/{FREE_DAILY_ASK_LIMIT}
                  </span>
                </div>
                <div
                  className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]"
                  role="progressbar"
                  aria-label="Daily Ask usage"
                  aria-valuemin={0}
                  aria-valuemax={freeAskUsage.limit}
                  aria-valuenow={freeAskUsage.used}
                >
                  <div
                    className="h-full rounded-full bg-[var(--vt-blue)] transition-[width]"
                    style={{ width: `${freeAskUsage.progressPercent}%` }}
                  />
                </div>
                <p className="mt-3 text-sm text-[var(--vt-muted)]">
                  {freeAskUsage.remaining === 0
                    ? "You’ve used today’s free messages. Resets at midnight UTC, or upgrade for unlimited Ask."
                    : `${freeAskUsage.remaining} free message${freeAskUsage.remaining === 1 ? "" : "s"} left today.`}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
                <Button asChild variant="default" size="pill">
                  <Link href="/pricing">View pricing & upgrade</Link>
                </Button>
              </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
                <Button asChild variant="default" size="pill">
                  <Link href="/pricing">View pricing & upgrade</Link>
                </Button>
              </div>
            )
          ) : (
            <div className="w-full space-y-10">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--vt-coral)]">
                    Subscription
                  </p>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      subscriptionStatusPillClass(subscription?.status),
                    )}
                  >
                    {getBillingStatusLabel(subscription?.status)}
                  </span>
                </div>
                <p className="text-lg font-semibold tracking-[-0.02em] text-white sm:text-xl">
                  {currentPlanLabel}
                </p>
                {isCanceling ? (
                  <p className="text-sm font-medium text-amber-200/95">
                    Cancels at the end of the current billing period.
                  </p>
                ) : (
                  <p className="max-w-md text-sm leading-relaxed text-[var(--vt-muted)]">
                    Payment methods, invoices, and plan changes are managed in Stripe. Updates sync back here.
                  </p>
                )}
              </div>
              <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-[200px]">
                <BillingActionButton
                  action="portal"
                  buttonVariant="default"
                  buttonSize="pill"
                  className="min-h-11 w-full justify-center px-5 font-bold sm:w-auto"
                >
                  <CreditCard className="size-4 opacity-95" strokeWidth={2.2} aria-hidden />
                  Manage in Stripe
                </BillingActionButton>
                {isCanceling ? (
                  <BillingActionButton
                    action="resume"
                    buttonVariant="success"
                    buttonSize="pill"
                    className="min-h-11 w-full justify-center sm:w-auto"
                    payload={{ action: "resume" }}
                    successMessage="Subscription resumed."
                  >
                    Keep subscription
                  </BillingActionButton>
                ) : (
                  <BillingActionButton
                    action="cancel"
                    buttonVariant="outline"
                    buttonSize="pill"
                    className="min-h-11 w-full justify-center border-white/15 text-white/90 hover:bg-white/[0.06] sm:w-auto"
                    payload={{ action: "cancel_at_period_end" }}
                    successMessage="Subscription set to cancel at period end."
                    confirmMessage="Cancel your subscription at the end of the current billing period?"
                  >
                    Cancel at period end
                  </BillingActionButton>
                )}
              </div>
            </div>

            <div className="border-t border-white/10 pt-8">
              <dl className="grid gap-6 sm:grid-cols-3 sm:gap-10">
                <div>
                  <dt className="text-xs font-medium text-[var(--vt-muted)]">Status</dt>
                  <dd className="mt-1.5 text-base font-semibold text-white">
                    {getBillingStatusLabel(subscription?.status)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--vt-muted)]">Recurring</dt>
                  <dd className="mt-1.5 text-base font-semibold tabular-nums text-white">{recurringAmount ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--vt-muted)]">{periodEndLabel}</dt>
                  <dd className="mt-1.5 text-base font-semibold tabular-nums text-white">{renewalDate ?? "—"}</dd>
                </div>
              </dl>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
