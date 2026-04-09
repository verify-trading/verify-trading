import { describe, expect, it } from "vitest";

import { appendSafeNextParam, getSafeRedirectPath } from "@/lib/auth/safe-redirect";

describe("getSafeRedirectPath", () => {
  it("allows normal app paths", () => {
    expect(getSafeRedirectPath("/ask")).toBe("/ask");
    expect(getSafeRedirectPath("/markets")).toBe("/markets");
    expect(getSafeRedirectPath("/auth/update-password")).toBe("/auth/update-password");
    expect(getSafeRedirectPath("/ask?tab=1")).toBe("/ask?tab=1");
  });

  it("rejects protocol-relative URLs (open redirect)", () => {
    expect(getSafeRedirectPath("//evil.com/phish", "/ask")).toBe("/ask");
    expect(getSafeRedirectPath("//evil.com", "/ask")).toBe("/ask");
  });

  it("rejects absolute URLs and backslashes", () => {
    expect(getSafeRedirectPath("https://evil.com", "/ask")).toBe("/ask");
    expect(getSafeRedirectPath("/\\evil.com", "/ask")).toBe("/ask");
    expect(getSafeRedirectPath("http://evil.com/path", "/ask")).toBe("/ask");
  });

  it("uses fallback for empty or null", () => {
    expect(getSafeRedirectPath(null, "/ask")).toBe("/ask");
    expect(getSafeRedirectPath(undefined, "/markets")).toBe("/markets");
    expect(getSafeRedirectPath("", "/x")).toBe("/x");
    expect(getSafeRedirectPath("   ", "/x")).toBe("/x");
  });

  it("rejects paths not starting with slash", () => {
    expect(getSafeRedirectPath("ask", "/ask")).toBe("/ask");
    expect(getSafeRedirectPath("relative", "/ask")).toBe("/ask");
  });

  it("propagates safe next params between auth pages", () => {
    expect(appendSafeNextParam("/signup", "/markets?tab=1")).toBe("/signup?next=%2Fmarkets%3Ftab%3D1");
    expect(appendSafeNextParam("/login?mode=reset", "/ask")).toBe("/login?mode=reset&next=%2Fask");
  });

  it("omits invalid or empty next params when building auth links", () => {
    expect(appendSafeNextParam("/signup", null)).toBe("/signup");
    expect(appendSafeNextParam("/signup", "https://evil.com")).toBe("/signup");
    expect(appendSafeNextParam("/signup", "   ")).toBe("/signup");
  });
});
