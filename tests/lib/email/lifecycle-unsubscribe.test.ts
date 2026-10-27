import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildUnsubscribeUrl,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from "@/lib/email/lifecycle/unsubscribe";

const USER = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";
const OTHER = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

describe("lifecycle unsubscribe tokens", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "test-secret-test-secret-test-secret");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.verify.trading/");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("verifies a token it signed", () => {
    expect(verifyUnsubscribeToken(USER, signUnsubscribeToken(USER))).toBe(true);
  });

  it("is domain-separated from other uses of CRON_SECRET", () => {
    const plainHmac = createHmac("sha256", "test-secret-test-secret-test-secret").update(USER).digest("base64url");

    expect(signUnsubscribeToken(USER)).not.toBe(plainHmac);
    expect(verifyUnsubscribeToken(USER, plainHmac)).toBe(false);
  });

  it("rejects a wrong token, an empty token and a token for another user", () => {
    const token = signUnsubscribeToken(USER);
    expect(verifyUnsubscribeToken(USER, `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`)).toBe(false);
    expect(verifyUnsubscribeToken(USER, token.slice(1))).toBe(false);
    expect(verifyUnsubscribeToken(USER, "")).toBe(false);
    expect(verifyUnsubscribeToken(OTHER, token)).toBe(false);
  });

  it("rejects a user id that is not a UUID", () => {
    const notUuid = "not-a-uuid";
    expect(verifyUnsubscribeToken(notUuid, signUnsubscribeToken(notUuid))).toBe(false);
  });

  it("fails closed without a secret", () => {
    const token = signUnsubscribeToken(USER);
    vi.stubEnv("CRON_SECRET", "");
    expect(verifyUnsubscribeToken(USER, token)).toBe(false);
    expect(() => signUnsubscribeToken(USER)).toThrow(/CRON_SECRET/);
    expect(() => buildUnsubscribeUrl(USER)).toThrow();
  });

  it("builds an encoded link on the site URL", () => {
    const url = new URL(buildUnsubscribeUrl(USER));
    expect(`${url.origin}${url.pathname}`).toBe("https://www.verify.trading/api/email/unsubscribe");
    expect(url.searchParams.get("u")).toBe(USER);
    expect(url.searchParams.get("t")).toBe(signUnsubscribeToken(USER));
  });
});
