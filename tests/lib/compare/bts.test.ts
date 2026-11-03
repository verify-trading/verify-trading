import { describe, expect, it } from "vitest";

import { countryView, normalizeCountry, parseLicences, pillarDisplay, toVerdict } from "@/lib/compare/bts";

const IG = { verdict: "Verified", score: 93 } as const;
const row = (country: string, fit: string, score: number | null, verdict: string) => ({ country, fit, score, verdict, licences: null, note: `note ${country}` });

describe("BTS country layer", () => {
  it("shows the full country verdict in GB", () => {
    expect(countryView(IG, row("GB", "LOCAL LICENCE VERIFIED", 93, "VERIFIED"), "GB")).toMatchObject({ verdict: "Verified", score: 93, global: false });
  });

  it("falls back to the global rating for 'no local licence' outside the live markets", () => {
    // IG in South Africa: the engine says 40 Caution only because FSCA licence data is incomplete.
    const za = countryView(IG, row("ZA", "NO LOCAL LICENCE VERIFIED", 40, "CAUTION"), "ZA");
    expect(za).toMatchObject({ verdict: "Verified", score: 93, global: true });
    expect(za.note).toMatch(/South Africa in progress/);
  });

  it("always shows Not available, without a score", () => {
    expect(countryView(IG, row("US", "NOT AVAILABLE", 93, "NOT AVAILABLE IN YOUR COUNTRY"), "US")).toMatchObject({ verdict: "Not available", score: null });
  });

  it("uses the global rating when the country is unknown or has no row", () => {
    expect(countryView(IG, undefined, "XX")).toMatchObject({ verdict: "Verified", score: 93, note: null });
    expect(normalizeCountry("gb")).toBe("GB");
    expect(normalizeCountry("ZZ")).toBe("XX");
    expect(normalizeCountry(null)).toBe("XX");
  });
});

describe("engine field parsing", () => {
  it("maps verdicts and licences", () => {
    expect(toVerdict("HIGH RISK")).toBe("High risk");
    expect(toVerdict("something new")).toBe("Under review");
    expect(parseLicences("FCA:684312|CYSEC:388/20 (Pepperstone EU)|FSA_SC:n/a")).toEqual([
      { code: "FCA", number: "684312" },
      { code: "CYSEC", number: "388/20" },
      { code: "FSA_SC", number: null },
    ]);
    expect(pillarDisplay({ label: "Conduct", max: 25, value: "not checked" })).toBe("Not yet checked");
    expect(pillarDisplay({ label: "Regulation", max: 40, value: "35" })).toBe("35 / 40");
  });
});


describe("regulation label", () => {
  it("lists verified regulators, FCA last and scoped outside the UK", async () => {
    const { regulationLabel } = await import("@/lib/compare/regulators");
    expect(regulationLabel("FCA:684312|CYSEC:388/20", "GB")).toBe("FCA, CySEC");
    expect(regulationLabel("FCA:684312|CYSEC:388/20", "MA")).toBe("CySEC, FCA (UK entity)");
    expect(regulationLabel("none", "GB")).toBeNull();
  });
});

describe("regulation label with live-confirmed regulators", () => {
  it("adds live register finds first and spells out shared codes", async () => {
    const { regulationLabel } = await import("@/lib/compare/regulators");
    expect(regulationLabel(undefined, "ZA", ["FSA Seychelles", "FSCA"])).toBe("FSA Seychelles, FSCA");
    expect(regulationLabel("FSA_SC:SD028|CYSEC:120/10", "NG")).toBe("FSA Seychelles, CySEC");
    expect(regulationLabel("FCA:1", "MA", ["FCA", "FSA Seychelles"])).toBe("FSA Seychelles, FCA (UK entity)");
  });
});
