"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { BillingPlanKey } from "@/lib/billing/config";

/**
 * Resumes Stripe checkout after a signed-out user picked a plan and signed up.
 * The pricing CTA sends them to /signup?next=/billing?plan=<plan>; once they land
 * here authenticated, this starts checkout and redirects to Stripe. On failure it
 * steps aside so the billing page's plan buttons are usable.
 */
export function CheckoutAutoStart({ plan, trial = false }: { plan: BillingPlanKey; trial?: boolean }) {
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;

    void (async () => {
      try {
        const rewardfulReferral = window.Rewardful?.referral;
        const response = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ plan, trial, ...(rewardfulReferral ? { rewardfulReferral } : {}) }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { url?: string; message?: string }
          | null;

        if (response.ok && payload?.url) {
          window.location.assign(payload.url);
          return;
        }

        toast.error(payload?.message ?? "Could not start Stripe checkout.");
        setFailed(true);
      } catch {
        toast.error("Could not start Stripe checkout.");
        setFailed(true);
      }
    })();
  }, [plan, trial]);

  if (failed) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-(--vt-navy)/80 backdrop-blur-sm">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-medium text-white">
        <span className="size-4 animate-spin rounded-full border-2 border-white/20 border-t-white" aria-hidden />
        Redirecting to secure checkout…
      </div>
    </div>
  );
}
