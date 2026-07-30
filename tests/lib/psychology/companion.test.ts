import { describe, expect, it } from "vitest";

import { generatePsychologyReply, speakable, type ChallengeContext, type RecentEntry } from "@/lib/psychology/companion";

// Live check that the coach now grounds its reply in the trader's actual challenge +
// journal. Opt-in (model call):
//   set -a; source <(grep -E '^ANTHROPIC_(API_KEY|MODEL|BASE_URL)=' .env.local); set +a
//   RUN_COACH_TEST=1 npx vitest run companion --disableConsoleIntercept
const assessment = {
  total_score: 57,
  zone_label: "At-Risk Trader",
  focus_area: "compulsion",
  q29_focus: "stop revenge trading after losses",
  q1_trading_situation: "on a funded challenge, feeling pressure",
  q2_stress_level: "high",
  q3_financial_situation: "relying on this income",
  q4_sleep_quality: "poor",
  q5_energy_level: "low",
  flag_chasing: true,
  flag_compulsive: true,
  flag_financial_pressure: true,
} as never;

const challenge: ChallengeContext = {
  firmName: "FTMO",
  accountType: "2step",
  accountSize: 100_000,
  rules: {
    firm_name: "FTMO",
    daily_loss_limit: "5%",
    max_drawdown: "10%",
    profit_target: "10%",
    min_trading_days: 4,
    max_trading_days: 30,
    weekend_holding: true,
    news_trading_allowed: true,
    other_rules: ["Consistency rule applies", "No martingale"],
  },
  cumulativePnl: 1216,
  daysTraded: 8,
  targetAmount: 10_000,
  progressPct: 0.1216,
  amountToGo: 8784,
  daysLeft: 22,
};

const recentEntries: RecentEntry[] = [
  { date: "2026-07-06", pnl: -190, mood: "tough", note: "moved my stop after it went against me, gave back the morning gains", lesson: "honour the stop" },
  { date: "2026-07-03", pnl: 250, mood: "good", note: "stuck to the plan, took profit at target", lesson: null },
  { date: "2026-06-11", pnl: 210, mood: "okay", note: "small size, patient", lesson: null },
];

const run = process.env.RUN_COACH_TEST ? describe : describe.skip;
run("generatePsychologyReply (live, enriched)", () => {
  it("grounds the reply in the firm rules, progress and recent sessions", async () => {
    const transcript = "I just took a loss and I really want to double my size on the next trade to win it back. I'm so close to passing.";
    const reply = await generatePsychologyReply({ name: "Alex", transcript, assessment, journal: { sessionCount: 6, weeklyPnl: 270, wins: 4, toughSessions: 2, winningStreak: 3, losingStreak: 0 }, challenge, recentEntries });
    console.log("\n=== COACH REPLY ===\n" + reply + "\n===================\n");
  }, 60_000);
});

// The realtime coach applies speakable() to each streamed delta, so trimming inside it welded
// the chunks together and TTS spoke "withthe sleep you've been getting".
describe("speakable", () => {
  it("keeps the space between streamed deltas", () => {
    expect(["Yeah, with", " the sleep", " you've had"].map(speakable).join("")).toBe(
      "Yeah, with the sleep you've had",
    );
  });

  it("still strips markdown glyphs and collapses newlines", () => {
    expect(speakable("**Hey**\n\nthere").trim()).toBe("Hey there");
  });
});
