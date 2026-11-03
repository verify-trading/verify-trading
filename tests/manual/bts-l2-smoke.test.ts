/** Opt-in: real gateway research and Supabase cache write. */
import { describe, expect, it } from "vitest";
import { loadDotEnvLocal } from "./env-local";

loadDotEnvLocal();

// Unknown firms intentionally omit kind: the researcher identifies the service first.
describe.skipIf(process.env.RUN_BTS_L2_SMOKE !== "1")("live Layer 2", () => {
  it("researches with retrieved evidence and reuses the stored assessment", async () => {
    const { getL2Assessment } = await import("@/lib/compare/bts-l2");
    const { getBtsAskContextByBrand } = await import("@/lib/compare/bts-data");
    const firm = process.env.BTS_SMOKE_FIRM ?? "Elites Funding";
    const baseline = await getBtsAskContextByBrand(firm, "GB");
    const subject = {
      firm, country: "GB",
      ...(baseline && baseline.type !== "tool" ? { entityId: baseline.entityId, kind: baseline.type, baseline: { score: baseline.global.score, verdict: baseline.global.verdict } } : {}),
    };
    const result = await getL2Assessment(subject);
    expect(result).not.toBeNull();
    expect(result!.sources.length).toBeGreaterThan(0);
    expect(result!.pillars).toHaveLength(5);
    expect(result!.finalScore).toBe(result!.pillars.reduce((sum, p) => sum + p.awarded, 0));
    const cached = await getL2Assessment(subject);
    expect(cached).toEqual({ ...result, checkedAt: cached!.checkedAt });
    expect(Date.parse(cached!.checkedAt)).toBe(Date.parse(result!.checkedAt));
    const { resolveVerificationToolResult } = await import("@/lib/ask/service/tools");
    const card = await resolveVerificationToolResult(firm, {}, "GB");
    expect("card" in card && card.card.type === "broker" && card.card.score).toBe(`${result!.finalScore}/100`);
    expect("uiMeta" in card && card.uiMeta?.verification?.sources.length).toBeGreaterThan(0);
    console.info(JSON.stringify({ firm: subject.firm, score: result!.finalScore, verdict: result!.verdict, summary: result!.summary, sources: result!.sources, checkedAt: result!.checkedAt }));
  }, 300_000);
});
