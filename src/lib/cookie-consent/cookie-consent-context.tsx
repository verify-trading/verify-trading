"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { CookieConsentBanner } from "@/components/site/cookie-consent-banner";
import {
  dispatchConsentChange,
  readConsentFromStorage,
  writeConsentToStorage,
  type CookieConsentChoice,
} from "@/lib/cookie-consent/storage";

type Status = "loading" | "pending" | "resolved";

type CookieConsentContextValue = {
  status: Status;
  choice: CookieConsentChoice | null;
  acceptAll: () => void;
  acceptEssentialOnly: () => void;
  analyticsAllowed: boolean;
  marketingAllowed: boolean;
};

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

/**
 * Toggle off while the consent approach is undecided. When `false`, no banner is shown and users
 * without stored consent are treated as resolved with no choice (analytics flags stay off).
 * Flip to `true` to show the banner again for visitors who have not consented yet.
 */
export const COOKIE_CONSENT_BANNER_ENABLED = false;

function initialCookieConsentState(): { status: Status; choice: CookieConsentChoice | null } {
  const stored = readConsentFromStorage();
  if (stored) {
    return { status: "resolved", choice: stored.choice };
  }
  if (!COOKIE_CONSENT_BANNER_ENABLED) {
    return { status: "resolved", choice: null };
  }
  return { status: "pending", choice: null };
}

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialCookieConsentState);
  const { status, choice } = state;

  useEffect(() => {
    if (status === "pending") {
      document.body.dataset.cookieBanner = "open";
    } else {
      delete document.body.dataset.cookieBanner;
    }
    return () => {
      delete document.body.dataset.cookieBanner;
    };
  }, [status]);

  const acceptAll = useCallback(() => {
    writeConsentToStorage("all");
    dispatchConsentChange("all");
    setState({ choice: "all", status: "resolved" });
  }, []);

  const acceptEssentialOnly = useCallback(() => {
    writeConsentToStorage("essential");
    dispatchConsentChange("essential");
    setState({ choice: "essential", status: "resolved" });
  }, []);

  const value = useMemo<CookieConsentContextValue>(
    () => ({
      status,
      choice,
      acceptAll,
      acceptEssentialOnly,
      analyticsAllowed: choice === "all",
      marketingAllowed: choice === "all",
    }),
    [status, choice, acceptAll, acceptEssentialOnly],
  );

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
      {status === "pending" ? (
        <CookieConsentBanner onAcceptAll={acceptAll} onEssentialOnly={acceptEssentialOnly} />
      ) : null}
    </CookieConsentContext.Provider>
  );
}

function useCookieConsent(): CookieConsentContextValue {
  const ctx = use(CookieConsentContext);
  if (!ctx) {
    throw new Error("useCookieConsent must be used within CookieConsentProvider");
  }
  return ctx;
}
