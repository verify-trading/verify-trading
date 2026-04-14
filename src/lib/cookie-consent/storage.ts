export const COOKIE_CONSENT_STORAGE_KEY = "vt:cookie-consent" as const;

/** Bump when categories or purposes change so users see the banner again. */
export const COOKIE_CONSENT_POLICY_VERSION = 1 as const;

export type CookieConsentChoice = "all" | "essential";

export type StoredCookieConsent = {
  v: number;
  choice: CookieConsentChoice;
  at: string;
};

export const COOKIE_CONSENT_CHANGE_EVENT = "vt:cookie-consent-change" as const;

export type CookieConsentChangeDetail = { choice: CookieConsentChoice };

export function parseStoredConsent(raw: string | null): StoredCookieConsent | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const o = parsed as { v?: unknown; choice?: unknown; at?: unknown };
    if (o.v !== COOKIE_CONSENT_POLICY_VERSION) {
      return null;
    }
    if (o.choice !== "all" && o.choice !== "essential") {
      return null;
    }
    const at = typeof o.at === "string" ? o.at : new Date().toISOString();
    return { v: o.v, choice: o.choice, at };
  } catch {
    return null;
  }
}

export function readConsentFromStorage(): StoredCookieConsent | null {
  if (typeof window === "undefined") {
    return null;
  }
  return parseStoredConsent(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY));
}

export function writeConsentToStorage(choice: CookieConsentChoice): void {
  const payload: StoredCookieConsent = {
    v: COOKIE_CONSENT_POLICY_VERSION,
    choice,
    at: new Date().toISOString(),
  };
  localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(payload));
}

export function dispatchConsentChange(choice: CookieConsentChoice): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<CookieConsentChangeDetail>(COOKIE_CONSENT_CHANGE_EVENT, {
      detail: { choice },
    }),
  );
}
