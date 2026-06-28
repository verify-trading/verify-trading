"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { VariantProps } from "class-variance-authority";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Modal } from "@/components/ui/modal";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import type { BillingPlanKey } from "@/lib/billing/config";
import {
  trackMetaInitiateCheckout,
  trackMetaPurchase,
} from "@/lib/marketing/meta-pixel";

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

// Rewardful global type
declare global {
  interface Window {
    Rewardful?: { referral?: string };
  }
}

type BillingActionButtonProps = {
  action: "checkout" | "portal" | "cancel" | "resume";
  children: React.ReactNode;
  disabled?: boolean;
  payload?: Record<string, unknown>;
  successMessage?: string;
  confirmMessage?: string;
  /** Overrides automatic variant-from-action mapping. */
  buttonVariant?: ButtonVariant;
  buttonSize?: ButtonSize;
  className?: string;
  onActionStart?: () => void;
};

type BillingCheckoutSyncProps = {
  checkoutState: string | null;
  checkoutSessionId: string | null;
  checkoutPlan?: BillingPlanKey | null;
  checkoutValue?: number | null;
  checkoutCurrency?: string | null;
};

const PENDING_CHECKOUT_STORAGE_KEY = "vt_pending_checkout";

type PendingCheckoutTracking = {
  plan?: BillingPlanKey;
  value?: number;
  currency?: string;
};

function readPendingCheckoutTracking(): PendingCheckoutTracking | null {
  try {
    const stored = window.sessionStorage.getItem(PENDING_CHECKOUT_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as PendingCheckoutTracking) : null;
  } catch {
    return null;
  }
}

function writePendingCheckoutTracking(checkout: PendingCheckoutTracking | undefined) {
  if (!checkout) {
    return;
  }

  window.sessionStorage.setItem(PENDING_CHECKOUT_STORAGE_KEY, JSON.stringify(checkout));
}

async function syncCheckoutSession(checkoutSessionId: string) {
  const response = await fetch("/api/stripe/sync-checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      checkoutSessionId,
    }),
  });
  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
  return { ok: response.ok, message: payload?.message };
}

const actionConfig = {
  checkout: {
    endpoint: "/api/stripe/checkout",
    pendingLabel: "Redirecting…",
    fallbackError: "Could not start Stripe checkout.",
    redirectOnSuccess: true,
  },
  portal: {
    endpoint: "/api/stripe/customer-portal",
    pendingLabel: "Opening portal…",
    fallbackError: "Could not open the Stripe billing portal.",
    redirectOnSuccess: true,
  },
  cancel: {
    endpoint: "/api/stripe/subscription",
    pendingLabel: "Updating…",
    fallbackError: "Could not schedule cancellation.",
    redirectOnSuccess: false,
  },
  resume: {
    endpoint: "/api/stripe/subscription",
    pendingLabel: "Updating…",
    fallbackError: "Could not resume the subscription.",
    redirectOnSuccess: false,
  },
} as const;

function variantForAction(action: BillingActionButtonProps["action"]): ButtonVariant {
  switch (action) {
    case "checkout":
      return "default";
    case "portal":
      return "outline";
    case "cancel":
      return "destructive";
    case "resume":
      return "success";
    default:
      return "default";
  }
}
function waitForTrackingRequest() {
  return new Promise((resolve) => window.setTimeout(resolve, 350));
}
export function BillingActionButton({
  action,
  children,
  disabled = false,
  payload,
  successMessage,
  confirmMessage,
  buttonVariant,
  buttonSize,
  className,
  onActionStart,
}: BillingActionButtonProps) {
  const { refresh } = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const variant = buttonVariant ?? variantForAction(action);
  const size = buttonSize ?? "default";

  async function executeAction() {
    setIsPending(true);

    try {
      // Automatically include Rewardful referral on checkout actions.
      // For non-checkout actions or users without a referral, this is a no-op.
      const rewardfulReferral =
        action === "checkout" && typeof window !== "undefined"
          ? window.Rewardful?.referral
          : undefined;

      const finalPayload =
        action === "checkout"
          ? { ...(payload ?? {}), ...(rewardfulReferral ? { rewardfulReferral } : {}) }
          : payload;

      const response = await fetch(actionConfig[action].endpoint, {
        method: "POST",
        headers: finalPayload
          ? {
              "content-type": "application/json",
            }
          : undefined,
        body: finalPayload ? JSON.stringify(finalPayload) : undefined,
      });
      const responsePayload = (await response.json().catch(() => null)) as
        | {
            checkout?: {
              plan?: BillingPlanKey;
              currency?: string;
              value?: number;
            };
            message?: string;
            url?: string;
          }
        | null;

      if (!response.ok || (actionConfig[action].redirectOnSuccess && !responsePayload?.url)) {
        toast.error(responsePayload?.message ?? actionConfig[action].fallbackError);
        setIsPending(false);
        return;
      }

      if (actionConfig[action].redirectOnSuccess) {
        if (action === "checkout") {
          trackMetaInitiateCheckout({
            plan: responsePayload?.checkout?.plan,
            value: responsePayload?.checkout?.value,
            currency: responsePayload?.checkout?.currency,
          });
          writePendingCheckoutTracking(responsePayload?.checkout);
          await waitForTrackingRequest();
        }
        window.location.assign(responsePayload!.url!);
        return;
      }

      if (successMessage) {
        toast.success(responsePayload?.message ?? successMessage);
      }
      refresh();
      setIsPending(false);
      setConfirmOpen(false);
    } catch {
      toast.error(actionConfig[action].fallbackError);
      setIsPending(false);
    }
  }

  function handlePrimaryClick() {
    if (disabled || isPending) {
      return;
    }

    onActionStart?.();

    if (confirmMessage) {
      setConfirmOpen(true);
      return;
    }

    void executeAction();
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled || isPending}
        className={className}
        onClick={handlePrimaryClick}
      >
        {isPending ? actionConfig[action].pendingLabel : children}
      </Button>

      {confirmMessage ? (
        <Modal
          open={confirmOpen}
          onClose={() => {
            if (!isPending) {
              setConfirmOpen(false);
            }
          }}
          title="Confirm cancellation"
          preventClose={isPending}
          zIndexClass="z-[210]"
          footer={
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="pill"
                className="border-white/15"
                disabled={isPending}
                onClick={() => setConfirmOpen(false)}
              >
                Keep subscription
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="pill"
                disabled={isPending}
                onClick={() => void executeAction()}
              >
                {isPending ? actionConfig[action].pendingLabel : "Cancel at period end"}
              </Button>
            </div>
          }
        >
          <p className="text-sm leading-relaxed text-slate-300">{confirmMessage}</p>
        </Modal>
      ) : null}
    </>
  );
}

export function BillingCheckoutSync({
  checkoutState,
  checkoutSessionId,
  checkoutPlan,
  checkoutValue,
  checkoutCurrency,
}: BillingCheckoutSyncProps) {
  const { refresh, replace } = useRouter();
  const hasSynced = useRef(false);

  useEffect(() => {
    if (checkoutState !== "success" || !checkoutSessionId || hasSynced.current) {
      return;
    }

    hasSynced.current = true;

    void (async () => {
      try {
        const result = await syncCheckoutSession(checkoutSessionId);

        if (!result.ok) {
          toast.error(result.message ?? "Stripe checkout completed, but the local billing sync failed.");
        } else {
          const storageKey = `meta_purchase:${checkoutSessionId}`;
          const alreadyTracked =
            typeof window !== "undefined" && window.sessionStorage.getItem(storageKey) === "1";

          if (!alreadyTracked) {
            const pendingCheckout = readPendingCheckoutTracking();
            const trackedPlan = checkoutPlan ?? pendingCheckout?.plan ?? null;
            const trackedValue = checkoutValue ?? pendingCheckout?.value ?? null;
            const trackedCurrency = checkoutCurrency ?? pendingCheckout?.currency ?? null;
            trackMetaPurchase({
              plan: trackedPlan,
              value: trackedValue,
              currency: trackedCurrency,
              checkoutSessionId,
            });
            trackAnalyticsEvent(ANALYTICS_EVENTS.proUpgradeCompleted, {
              plan: trackedPlan ?? "unknown",
              value: trackedValue ?? undefined,
              currency: trackedCurrency ?? undefined,
              checkout_session_id: checkoutSessionId,
            });
            if (typeof window !== "undefined") {
              window.sessionStorage.setItem(storageKey, "1");
              window.sessionStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
            }
          }
          toast.success("Subscription activated.");
        }
      } catch {
        toast.error("Stripe checkout completed, but the local billing sync failed.");
      } finally {
        replace("/billing");
        refresh();
      }
    })();
  }, [checkoutCurrency, checkoutPlan, checkoutSessionId, checkoutState, checkoutValue, refresh, replace]);

  useEffect(() => {
    if (checkoutState === "cancelled") {
      replace("/billing");
    }
  }, [checkoutState, replace]);

  return null;
}
