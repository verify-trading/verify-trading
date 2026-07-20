import { describe, expect, it } from "vitest";

import { buildCorpus, extractChallengeRules, isSizeIndependent, pickRuleLinks, seedRulesFor } from "@/lib/journal/challenge";

// Homepage HTML modelled on the real link structures we observed while diagnosing the
// scrape (FundedNext keeps rules on /general-rules + /*-challenge-terms; The5ers names
// its plans "High Stakes" (2-step) and "Hyper Growth" (1-step)).
const FUNDEDNEXT_HOME = `
  <nav>
    <a href="/login">Login</a>
    <a href="/blog/how-i-passed">Blog</a>
    <a href="/how-it-works">How prop trading works</a>
    <a href="/general-rules">General rules</a>
    <a href="/cfd-challenge-terms">CFDs challenge terms</a>
    <a href="/futures-challenge-terms">Futures challenge terms</a>
    <a href="/instant-account-terms">Instant account terms</a>
    <a href="https://help.fundednext.com">Help centre (FAQ)</a>
    <a href="https://twitter.com/fundednext">Follow us</a>
  </nav>`;

const THE5ERS_HOME = `
  <nav>
    <a href="/hyper-growth/">1 Step | Hyper Growth</a>
    <a href="/high-stakes/">2 Step | High Stakes</a>
    <a href="/bootcamp/">3 Step | Bootcamp</a>
    <a href="/faqs/">FAQs</a>
    <a href="/about/">About us</a>
    <a href="mailto:hi@the5ers.com">Email</a>
  </nav>`;

describe("pickRuleLinks", () => {
  const base = new URL("https://fundednext.com/");

  it("keeps rule/challenge/terms pages and drops login, blog and off-site social links", () => {
    const links = pickRuleLinks(FUNDEDNEXT_HOME, base, "2step", 6);
    expect(links).toContain("https://fundednext.com/general-rules");
    expect(links).toContain("https://fundednext.com/cfd-challenge-terms");
    // same registrable domain (subdomain) is allowed…
    expect(links).toContain("https://help.fundednext.com/");
    // …but noise and off-site links are excluded.
    expect(links.join(" ")).not.toMatch(/\/login|\/blog|twitter\.com/);
  });

  it("resolves relative hrefs against the final homepage URL", () => {
    const links = pickRuleLinks(FUNDEDNEXT_HOME, base, "2step", 6);
    expect(links.every((url) => url.startsWith("https://"))).toBe(true);
  });

  it("ranks the plan matching the trader's account type first", () => {
    const five = new URL("https://the5ers.com/");
    expect(pickRuleLinks(THE5ERS_HOME, five, "2step", 3)[0]).toBe("https://the5ers.com/high-stakes/");
    expect(pickRuleLinks(THE5ERS_HOME, five, "1step", 3)[0]).toBe("https://the5ers.com/hyper-growth/");
  });

  it("honours the limit", () => {
    expect(pickRuleLinks(FUNDEDNEXT_HOME, base, "2step", 2)).toHaveLength(2);
  });
});

describe("buildCorpus", () => {
  const pages = [
    { url: "https://firm.com/", text: "home nav marketing shell", score: 0 },
    { url: "https://firm.com/faq", text: "some faq about payout and consistency", score: 2 },
    { url: "https://firm.com/rules", text: "profit target 8% daily loss 5% max drawdown 10% trading days", score: 6 },
  ];

  it("orders rule-dense pages first and the nav-heavy homepage last", () => {
    const corpus = buildCorpus(pages);
    const rulesAt = corpus.indexOf("SOURCE: https://firm.com/rules");
    const faqAt = corpus.indexOf("SOURCE: https://firm.com/faq");
    const homeAt = corpus.indexOf("SOURCE: https://firm.com/\n");
    expect(rulesAt).toBeGreaterThanOrEqual(0);
    expect(faqAt).toBeGreaterThan(rulesAt); // higher score comes first
    expect(homeAt).toBeGreaterThan(faqAt); // nav-heavy homepage goes last
  });

  it("labels each chunk with its SOURCE url", () => {
    const corpus = buildCorpus(pages);
    expect(corpus).toContain("SOURCE: https://firm.com/rules");
    expect(corpus).toContain("SOURCE: https://firm.com/faq");
  });

  it("stays within the overall character budget", () => {
    const huge = [
      { url: "https://firm.com/", text: "x".repeat(50_000), score: 0 },
      { url: "https://firm.com/rules", text: "y".repeat(50_000), score: 6 },
    ];
    // 32k budget + a little SOURCE/newline overhead per chunk.
    expect(buildCorpus(huge).length).toBeLessThan(33_000);
  });
});

describe("seedRulesFor", () => {
  it("returns cached rules for a seeded firm without scraping", () => {
    const rules = seedRulesFor({ firmUrl: "https://ftmo.com", accountSize: 100_000, accountType: "2step" });
    expect(rules?.firm_name).toBe("FTMO");
    expect(rules?.daily_loss_limit).toBe("5%");
  });

  it("serves percentage rules at any account size (client converts the %)", () => {
    const rules = seedRulesFor({ firmUrl: "https://www.ftmo.com/en/", accountSize: 25_000, accountType: "2step" });
    expect(rules?.max_drawdown).toBe("10%");
  });

  it("only serves dollar-denominated rules when the size matches what was captured", () => {
    // Topstep's seed is in dollars, captured at $100k.
    expect(seedRulesFor({ firmUrl: "https://topstep.com", accountSize: 100_000, accountType: "2step" })).not.toBeNull();
    expect(seedRulesFor({ firmUrl: "https://topstep.com", accountSize: 50_000, accountType: "2step" })).toBeNull();
  });

  it("misses unknown firms and non-seeded account types → live scrape", () => {
    expect(seedRulesFor({ firmUrl: "https://some-unknown-prop.xyz", accountSize: 100_000, accountType: "2step" })).toBeNull();
    expect(seedRulesFor({ firmUrl: "https://ftmo.com", accountSize: 100_000, accountType: "instant" })).toBeNull();
  });

  it("guards a non-percentage field: Alpha's daily loss is 'N/A', so it only serves at the captured size", () => {
    // Alpha Capital's core fields are profit_target "8%" + max_drawdown "10%" but
    // daily_loss_limit "N/A" — not all percentage-based, so it must not serve at a
    // different size than it was captured at (the same guard that catches a $ field).
    expect(seedRulesFor({ firmUrl: "https://alphacapitalgroup.uk", accountSize: 100_000, accountType: "2step" })).not.toBeNull();
    expect(seedRulesFor({ firmUrl: "https://alphacapitalgroup.uk", accountSize: 25_000, accountType: "2step" })).toBeNull();
  });
});

describe("isSizeIndependent (mixed dollar/percentage guard)", () => {
  it("treats percentage fields as size-independent and everything else as size-dependent", () => {
    expect(isSizeIndependent("10%")).toBe(true);
    expect(isSizeIndependent("5.5%")).toBe(true);
    expect(isSizeIndependent("$500")).toBe(false);
    expect(isSizeIndependent("$5,000")).toBe(false);
    expect(isSizeIndependent("N/A")).toBe(false);
  });

  it("a mixed set (profit_target '10%' + daily_loss_limit '$500') is NOT all size-independent", () => {
    // This is the latent bug: the old concatenated-string heuristic saw the '%' and
    // wrongly served the '$500' rule at any size. Every() over the predicate now fails.
    const mixed = ["10%", "$500", "8%"];
    expect(mixed.every(isSizeIndependent)).toBe(false);
    // An all-percentage set stays size-independent (unchanged behavior).
    expect(["10%", "5%", "10%"].every(isSizeIndependent)).toBe(true);
  });
});

describe("extractChallengeRules (cache hit)", () => {
  it("resolves a seeded firm instantly with no network or model call", async () => {
    const rules = await extractChallengeRules({ firmUrl: "https://ftmo.com", accountSize: 100_000, accountType: "2step" });
    expect(rules.firm_name).toBe("FTMO");
    expect(rules.profit_target).toBe("10%");
  });
});

// Live end-to-end scrape + model extraction against the real firm sites. Costs a model
// call and hits the network, so it's opt-in: RUN_SCRAPE_INTEGRATION=1 npx vitest run challenge
const runLive = process.env.RUN_SCRAPE_INTEGRATION ? describe : describe.skip;
runLive("extractChallengeRules (live)", () => {
  it(
    "returns real FundedNext rules (not N/A)",
    async () => {
      const rules = await extractChallengeRules({
        firmUrl: "https://fundednext.com",
        accountSize: 100_000,
        accountType: "2step",
      });
      // eslint-disable-next-line no-console
      console.log("FundedNext ->", JSON.stringify(rules, null, 2));
      expect(rules.firm_name.toLowerCase()).toContain("fundednext");
      expect(rules.profit_target).not.toMatch(/^n\/?a$/i);
      expect(rules.daily_loss_limit).not.toMatch(/^n\/?a$/i);
      expect(rules.max_drawdown).not.toMatch(/^n\/?a$/i);
    },
    120_000,
  );

  it(
    "returns real The5ers rules for the chosen plan",
    async () => {
      const rules = await extractChallengeRules({
        firmUrl: "https://the5ers.com",
        accountSize: 100_000,
        accountType: "2step",
      });
      // eslint-disable-next-line no-console
      console.log("The5ers ->", JSON.stringify(rules, null, 2));
      expect(rules.profit_target).not.toMatch(/^n\/?a$/i);
      expect(rules.max_drawdown).not.toMatch(/^n\/?a$/i);
    },
    120_000,
  );

  it(
    "still returns real FTMO rules",
    async () => {
      const rules = await extractChallengeRules({
        firmUrl: "https://ftmo.com",
        accountSize: 100_000,
        accountType: "2step",
      });
      // eslint-disable-next-line no-console
      console.log("FTMO ->", JSON.stringify(rules, null, 2));
      expect(rules.firm_name.toLowerCase()).toContain("ftmo");
      expect(rules.profit_target).not.toMatch(/^n\/?a$/i);
    },
    120_000,
  );
});
