"use client";

import {
  createContext,
  useCallback,
  useContext,
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

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [choice, setChoice] = useState<CookieConsentChoice | null>(null);

  useEffect(() => {
    const stored = readConsentFromStorage();
    if (stored) {
      setChoice(stored.choice);
      setStatus("resolved");
      return;
    }
    if (!COOKIE_CONSENT_BANNER_ENABLED) {
      setChoice(null);
      setStatus("resolved");
      return;
    }
    setStatus("pending");
  }, []);

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
    setChoice("all");
    setStatus("resolved");
  }, []);

  const acceptEssentialOnly = useCallback(() => {
    writeConsentToStorage("essential");
    dispatchConsentChange("essential");
    setChoice("essential");
    setStatus("resolved");
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

export function useCookieConsent(): CookieConsentContextValue {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) {
    throw new Error("useCookieConsent must be used within CookieConsentProvider");
  }
  return ctx;
}
