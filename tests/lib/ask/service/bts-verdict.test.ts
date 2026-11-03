import { describe, expect, it, vi } from "vitest";

import { resolveVerificationToolResult } from "@/lib/ask/service/tools";
import type { BtsAskContext } from "@/lib/compare/bts-data";

const lookupVerifiedEntityImpl = vi.fn().mockResolvedValue({
  found: true,
  entity: { id: "ig", name: "IG", type: "broker", status: "warning", fcaRegistered: true, fcaReference: "195355", fcaWarning: false, trustScore: 6, notes: "", source: "", aliases: ["ig"] },
  brokerCardHint: { name: "IG", score: "6.0", status: "WARNING", fca: "Yes", complaints: "Low", color: "red", provisional: false, band: "Proceed With Caution", founderNote: null },
});

// A live FCA lookup that disagrees (would normally downgrade the card to WARNING).
const getFcaStatusImpl = vi.fn().mockResolvedValue({ available: true, queriedName: "IG", frn: "195355", authorised: false, warning: true, statusText: "Not authorised", source: "FCA", note: "Clone firm alert" });

const context = (shown: BtsAskContext["shown"]): BtsAskContext =>
  ({ firm: "IG", type: "broker", entityId: "BTS-B-1", countryCode: "GB", userCountry: "United Kingdom (GB)", shown, global: { verdict: "Verified", score: 93, reason: "licence verified on register", licencesVerified: "FCA:195355" }, country: null }) as unknown as BtsAskContext;
const noLiveCheck = vi.fn().mockResolvedValue(null);

describe("Ask and the BTS engine", () => {
  it("shows the engine's verdict and score verbatim, whatever old fields or live FCA data say", async () => {
    const getBtsAskContextImpl = vi.fn().mockResolvedValue(context({ country: "GB", verdict: "Verified", score: 93, note: "Licensed by your country's regulator.", global: false }));
    const r = await resolveVerificationToolResult("IG", { lookupVerifiedEntityImpl, getFcaStatusImpl, getBtsAskContextImpl, getL2AssessmentImpl: noLiveCheck }, "GB");
    expect(getBtsAskContextImpl).toHaveBeenCalledWith("ig", "GB");
    expect("card" in r && r.card).toMatchObject({ score: "93/100", status: "LEGITIMATE", color: "green" });
    // The live check was unavailable, so the card says the score is the database's.
    expect("card" in r && r.card.type === "broker" && r.card.verdict).toMatch(/stored assessment\.$/);
    expect("bts" in r && r.bts?.shown.score).toBe(93);
  });

  it("never invents a number when the engine shows none", async () => {
    const getBtsAskContextImpl = vi.fn().mockResolvedValue(context({ country: "US", verdict: "Not available", score: null, note: "Not offered in the US.", global: false }));
    const r = await resolveVerificationToolResult("IG", { lookupVerifiedEntityImpl, getFcaStatusImpl, getBtsAskContextImpl, getL2AssessmentImpl: noLiveCheck });
    expect("card" in r && r.card).toMatchObject({ score: "No score", status: "WARNING" });
  });

  it.each([['active', 'needs_review'], ['inactive', 'complete'], ['redirected', 'complete'], ['merged', 'complete'], ['unknown', 'complete']])('enforces %s / %s before calling live research', async (operatingStatus, researchStatus) => {
    const bts = { ...context({ country: "GB", verdict: "Verified", score: 93, note: null, global: false }), operatingStatus, researchStatus };
    const live = vi.fn();
    const result = await resolveVerificationToolResult("IG", { lookupVerifiedEntityImpl, getFcaStatusImpl, getBtsAskContextImpl: vi.fn().mockResolvedValue(bts), getL2AssessmentImpl: live }, "GB");
    expect(live).not.toHaveBeenCalled();
    expect("card" in result && result.card).toMatchObject({ score: "No score", status: "WARNING", color: "red" });
    if (researchStatus === "needs_review") expect("card" in result && result.card.type === "broker" && result.card.verdict).toBe("We're still verifying this firm.");
  });

  it("does not give a lookalike website the legitimate firm's assessment", async () => {
    const bts = { ...context({ country: "GB", verdict: "Verified", score: 93, note: null, global: false }), research: { website: "https://ig.com" } };
    const live = vi.fn();
    const result = await resolveVerificationToolResult("https://ig-clone.com", { lookupVerifiedEntityImpl, getFcaStatusImpl, getBtsAskContextImpl: vi.fn().mockResolvedValue(bts), getL2AssessmentImpl: live }, "GB");
    expect(live).not.toHaveBeenCalled();
    expect("card" in result).toBe(false);
    expect("coverage" in result).toBe(true);
    expect("bts" in result).toBe(false);
  });

  it("preserves the needs-review answer when the model tries to praise the firm", async () => {
    const bts = { ...context({ country: "GB", verdict: "Verified", score: 93, note: null, global: false }), operatingStatus: "active", researchStatus: "needs_review" };
    const result = await resolveVerificationToolResult("IG", { lookupVerifiedEntityImpl, getFcaStatusImpl, getBtsAskContextImpl: vi.fn().mockResolvedValue(bts), getL2AssessmentImpl: noLiveCheck }, "GB");
    const { mergeToolOwnedNumbers } = await import("@/lib/ask/pipeline");
    const modelCard = { type: "broker", name: "IG", score: "99/100", status: "LEGITIMATE", fca: "Yes", complaints: "Low", verdict: "A great safe choice.", color: "green" } as const;
    expect(mergeToolOwnedNumbers(modelCard, [{ toolName: "verify_entity", output: result }] as never)).toMatchObject({ score: "No score", status: "WARNING", verdict: "We're still verifying this firm." });
  });

  it("shows the live check's final score instead of the engine's, and hides the engine's number from the model", async () => {
    const getBtsAskContextImpl = vi.fn().mockResolvedValue(context({ country: "GB", verdict: "Verified", score: 93, note: null, global: false }));
    const getL2AssessmentImpl = vi.fn().mockResolvedValue({
      kind: "broker", finalScore: 76, verdict: "Generally positive", confidence: 72, rubricVersion: "l2-broker-1.0", countryFit: "CONFIRMED_LOCALLY",
      identity: { confirmed: true, legal_entity: "IG Markets Ltd", official_website: "https://ig.com", note: "" },
      pillars: [{ key: "conduct", label: "Verified conduct", max: 25, awarded: 18, reason: "fine in 2019, settled", sourced: true, sources: ["s1"] }],
      findings: [{ authority: "FCA", legal_entity: "IG Markets Ltd", jurisdiction: "GB", date: "2019-01-01", finding: "fine", outcome: "paid", adverse: true, url: "https://fca.org.uk/x", source_id: "s1" }],
      sources: [{ id: "s1", url: "https://fca.org.uk/x", type: "regulator_notice", title: "FCA" }],
      strengths: [], risks: ["r"], summary: "Licensed in the UK; one settled fine.", model: "gpt-6.1-terra", checkedAt: "2026-11-03T12:00:00Z",
    });
    const r = await resolveVerificationToolResult("IG", { lookupVerifiedEntityImpl, getFcaStatusImpl, getBtsAskContextImpl, getL2AssessmentImpl }, "GB");
    expect(getL2AssessmentImpl).toHaveBeenCalledWith(expect.objectContaining({ firm: "IG", kind: "broker", country: "GB", entityId: "BTS-B-1", baseline: { score: 93, verdict: "Verified" } }));
    expect("card" in r && r.card).toMatchObject({ score: "76/100", status: "LEGITIMATE", complaints: "On record" });
    expect(JSON.stringify(r.bts)).not.toContain("93");
    expect(r.bts).toMatchObject({ scoreSource: "Independent live check", liveCheck: { findings: [{ authority: "FCA", url: "https://fca.org.uk/x" }] } });
    expect("uiMeta" in r && r.uiMeta?.verification).toMatchObject({ confidence: 72, sources: [{ url: "https://fca.org.uk/x" }] });
  });
});

it("runs Layer 2 for a firm outside the database and publishes its score with sources", async () => {
  const getL2AssessmentImpl = vi.fn().mockResolvedValue({
    kind: "broker", finalScore: 75, verdict: "Generally positive", confidence: 70,
    countryFit: "UNVERIFIED", checkedAt: "2026-11-03T12:00:00Z",
    identity: { legal_entity: "Example Ltd", official_website: "https://example.com" },
    pillars: [], findings: [], strengths: [], risks: ["Local availability remains unverified."],
    summary: "Example is an identifiable broker.", sources: [{ title: "Register", url: "https://example.com/register", type: "official_register" }],
  });
  const fca = vi.fn();
  const result = await resolveVerificationToolResult("Example", {
    lookupVerifiedEntityImpl: vi.fn().mockResolvedValue({ found: false }),
    getBtsAskContextByBrandImpl: vi.fn().mockResolvedValue(null),
    getL2AssessmentImpl, getFcaStatusImpl: fca,
  }, "GB");
  expect(getL2AssessmentImpl).toHaveBeenCalledWith({ firm: "Example", country: "GB" });
  expect(fca).not.toHaveBeenCalled();
  expect("card" in result && result.card).toMatchObject({ name: "Example", score: "75/100", status: "LEGITIMATE" });
  expect("card" in result && result.card.type === "broker" && result.card.verdict).toContain("Local availability remains unverified.");
  expect("uiMeta" in result && result.uiMeta?.verification?.sources[0].url).toBe("https://example.com/register");
});

describe("card score guard (firms the engine scored but the site has no page for)", () => {
  const card = (name: string) => ({ type: "broker", name, score: "88", status: "LEGITIMATE", fca: "No", complaints: "Medium", verdict: "x", color: "green" }) as const;
  const results = [{ toolName: "verify_entity", output: { coverage: {}, bts: { firm: "Binance", shown: { verdict: "Caution", score: 40 } } } }];

  it("takes the engine's score and status, never the model's", async () => {
    const { mergeToolOwnedNumbers } = await import("@/lib/ask/pipeline");
    expect(mergeToolOwnedNumbers(card("Binance"), results as never)).toMatchObject({ score: "40/100", status: "WARNING", color: "red" });
  });

  it("forces N/A when the card names a different firm", async () => {
    const { mergeToolOwnedNumbers } = await import("@/lib/ask/pipeline");
    expect(mergeToolOwnedNumbers(card("Binance.US"), results as never)).toMatchObject({ score: "N/A" });
  });
});
