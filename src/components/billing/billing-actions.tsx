"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { VariantProps } from "class-variance-authority";

import { Button, buttonVariants } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

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
};

type BillingCheckoutSyncProps = {
  checkoutState: string | null;
  checkoutSessionId: string | null;
};

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
}: BillingActionButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const variant = buttonVariant ?? variantForAction(action);
  const size = buttonSize ?? "default";

  async function executeAction() {
    setIsPending(true);

    try {
      const response = await fetch(actionConfig[action].endpoint, {
        method: "POST",
        headers: payload
          ? {
              "content-type": "application/json",
            }
          : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const responsePayload = (await response.json().catch(() => null)) as
        | {
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
        window.location.assign(responsePayload!.url!);
        return;
      }

      if (successMessage) {
        toast.success(responsePayload?.message ?? successMessage);
      }
      router.refresh();
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
}: BillingCheckoutSyncProps) {
  const router = useRouter();
  const hasSynced = useRef(false);

  useEffect(() => {
    if (checkoutState !== "success" || !checkoutSessionId || hasSynced.current) {
      return;
    }

    hasSynced.current = true;

    void (async () => {
      try {
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

        if (!response.ok) {
          toast.error(payload?.message ?? "Stripe checkout completed, but the local billing sync failed.");
        } else {
          toast.success("Subscription activated.");
        }
      } catch {
        toast.error("Stripe checkout completed, but the local billing sync failed.");
      } finally {
        router.replace("/billing");
        router.refresh();
      }
    })();
  }, [checkoutSessionId, checkoutState, router]);

  useEffect(() => {
    if (checkoutState === "cancelled") {
      router.replace("/billing");
    }
  }, [checkoutState, router]);

  return null;
}
