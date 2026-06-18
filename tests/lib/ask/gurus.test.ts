import { describe, expect, it } from "vitest";

import { isValidCitation, resolveGuruTier } from "@/lib/ask/gurus";

const PUBLISHABLE = {
  researchStatus: "RESEARCHED",
  founderReviewed: true,
  identityConfirmed: true,
};

describe("resolveGuruTier — the Caution gate", () => {
  it("displays Caution only with a valid citation", () => {
    const result = resolveGuruTier({
      tier: "Caution",
      founderTierOverride: null,
      regulatorFlagSource: "https://www.fca.org.uk/news/warnings/example",
      verifiedTrackRecord: "No",
      ...PUBLISHABLE,
    });
    expect(result.tier).toBe("Caution");
  });

  it("downgrades an unsupported Caution to Unverified", () => {
    const result = resolveGuruTier({
      tier: "Caution",
      founderTierOverride: null,
      regulatorFlagSource: null,
      verifiedTrackRecord: "No",
      ...PUBLISHABLE,
    });
    expect(result.tier).toBe("Unverified");
  });

  it("downgrades a Caution whose source is not a real URL", () => {
    const result = resolveGuruTier({
      tier: "Caution",
      founderTierOverride: null,
      regulatorFlagSource: "founder says so",
      verifiedTrackRecord: "No",
      ...PUBLISHABLE,
    });
    expect(result.tier).toBe("Unverified");
  });

  it("applies the gate to a founder override too — no bypass", () => {
    const result = resolveGuruTier({
      tier: "Unverified",
      founderTierOverride: "Caution",
      regulatorFlagSource: null,
      verifiedTrackRecord: "No",
      ...PUBLISHABLE,
    });
    expect(result.tier).toBe("Unverified");
  });
});

describe("resolveGuruTier — the Verified bar", () => {
  it("requires a confirmed track record for Verified", () => {
    const claimed = resolveGuruTier({
      tier: "Verified",
      founderTierOverride: null,
      regulatorFlagSource: null,
      verifiedTrackRecord: "Claimed/Disputed",
      ...PUBLISHABLE,
    });
    expect(claimed.tier).toBe("Unverified");

    const confirmed = resolveGuruTier({
      tier: "Verified",
      founderTierOverride: null,
      regulatorFlagSource: null,
      verifiedTrackRecord: "Yes (confirmed)",
      ...PUBLISHABLE,
    });
    expect(confirmed.tier).toBe("Verified");
  });

  it("always allows softening to Unverified", () => {
    const result = resolveGuruTier({
      tier: "Caution",
      founderTierOverride: "Unverified",
      regulatorFlagSource: "https://www.fca.org.uk/x",
      verifiedTrackRecord: "No",
      ...PUBLISHABLE,
    });
    expect(result.tier).toBe("Unverified");
  });
});

describe("resolveGuruTier — the publish gate", () => {
  it("is publishable only when research, review, and identity all pass", () => {
    expect(resolveGuruTier({ ...base(), ...PUBLISHABLE }).publishable).toBe(true);
    expect(resolveGuruTier({ ...base(), ...PUBLISHABLE, founderReviewed: false }).publishable).toBe(false);
    expect(resolveGuruTier({ ...base(), ...PUBLISHABLE, identityConfirmed: false }).publishable).toBe(false);
    expect(
      resolveGuruTier({ ...base(), ...PUBLISHABLE, researchStatus: "DIRECTORY-THIN (verify before publish)" })
        .publishable,
    ).toBe(false);
  });
});

describe("isValidCitation", () => {
  it("accepts http(s) URLs and rejects everything else", () => {
    expect(isValidCitation("https://www.fca.org.uk/x")).toBe(true);
    expect(isValidCitation("http://sec.gov/x")).toBe(true);
    expect(isValidCitation("")).toBe(false);
    expect(isValidCitation(null)).toBe(false);
    expect(isValidCitation("just a note")).toBe(false);
    expect(isValidCitation("ftp://example.com")).toBe(false);
  });
});

function base() {
  return {
    tier: "Unverified",
    founderTierOverride: null,
    regulatorFlagSource: null,
    verifiedTrackRecord: "No",
  };
}
