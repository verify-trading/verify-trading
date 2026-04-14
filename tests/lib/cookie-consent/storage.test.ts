import { describe, expect, it } from "vitest";

import {
  COOKIE_CONSENT_POLICY_VERSION,
  parseStoredConsent,
} from "@/lib/cookie-consent/storage";

describe("parseStoredConsent", () => {
  it("returns null for empty or invalid input", () => {
    expect(parseStoredConsent(null)).toBeNull();
    expect(parseStoredConsent("")).toBeNull();
    expect(parseStoredConsent("not-json")).toBeNull();
    expect(parseStoredConsent("{}")).toBeNull();
  });

  it("returns null when policy version mismatches", () => {
    const raw = JSON.stringify({
      v: COOKIE_CONSENT_POLICY_VERSION + 99,
      choice: "all",
      at: "2026-01-01T00:00:00.000Z",
    });
    expect(parseStoredConsent(raw)).toBeNull();
  });

  it("parses valid stored consent", () => {
    const raw = JSON.stringify({
      v: COOKIE_CONSENT_POLICY_VERSION,
      choice: "essential",
      at: "2026-04-11T12:00:00.000Z",
    });
    expect(parseStoredConsent(raw)).toEqual({
      v: COOKIE_CONSENT_POLICY_VERSION,
      choice: "essential",
      at: "2026-04-11T12:00:00.000Z",
    });
  });
});
