"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getAppName } from "@/lib/site-config";

type CookieConsentBannerProps = {
  onAcceptAll: () => void;
  onEssentialOnly: () => void;
};

export function CookieConsentBanner({ onAcceptAll, onEssentialOnly }: CookieConsentBannerProps) {
  const app = getAppName();

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      role="region"
      aria-label="Cookie consent"
    >
      <div
        className="pointer-events-auto flex w-full max-w-3xl flex-col gap-4 rounded-2xl border border-[color:var(--vt-border)] bg-[rgba(10,13,46,0.97)] px-4 py-4 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5 sm:py-4"
      >
        <p className="text-sm leading-relaxed text-slate-300">
          <span className="font-semibold text-white">{app}</span> uses cookies and similar storage to
          keep you signed in, protect sessions, and run the product. With your permission we may also
          use optional cookies to measure and improve the experience. Read the{" "}
          <Link href="/cookies" className="font-medium text-[var(--vt-blue)] underline-offset-2 hover:underline">
            Cookie Notice
          </Link>
          .
        </p>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="pillCompact" onClick={onEssentialOnly}>
            Essential only
          </Button>
          <Button type="button" variant="default" size="pillCompact" onClick={onAcceptAll}>
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
}
