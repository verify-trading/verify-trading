import { describe, expect, it } from "vitest";

import { EMAILS } from "@/lib/email/lifecycle/config";
import {
  classifyTopic,
  factsFromRow,
  firstNameFrom,
  isInsideSendWindow,
  pickEmail,
} from "@/lib/email/lifecycle/pick";
import type { EmailKind, EmailSendRecord, UserFacts } from "@/lib/email/lifecycle/types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// 13:00 London (BST).
const NOW = new Date("2026-10-15T12:00:00Z");

const ago = (hours: number) => new Date(NOW.getTime() - hours * HOUR);
const sent = (emailId: string, hoursAgo: number, kind: EmailKind = "marketing"): EmailSendRecord => ({
  emailId,
  kind,
  sentAt: ago(hoursAgo),
});

function makeFacts(overrides: Partial<UserFacts> = {}): UserFacts {
  return {
    userId: "user-1",
    email: "trader@example.com",
    displayName: "Sam Trader",
    tier: "free",
    signupAt: ago(10 * 24),
    emailOptOutAt: null,
    firstActiveAt: null,
    lastActiveAt: null,
    activeDays: 0,
    thirdActiveAt: null,
    cappedToday: false,
    firstQuestion: null,
    proSince: null,
    checkoutStartedAt: null,
    checkoutPlan: null,
    sends: [],
    ...overrides,
  };
}

const pickId = (overrides: Partial<UserFacts>, now = NOW) => pickEmail(makeFacts(overrides), now)?.emailId ?? null;

describe("config", () => {
  it("has one marketing entry per scheduled email with unique priorities", () => {
    expect(EMAILS.map((email) => email.id).sort()).toEqual(
      ["c1", "c2", "c3", "c4", "c6", "e2a", "e2b", "e3a", "e3b", "r1", "r2", "r3"],
    );
    expect(new Set(EMAILS.map((email) => email.priority)).size).toBe(EMAILS.length);
    expect(EMAILS.every((email) => email.kind === "marketing")).toBe(true);
  });

  it("never picks a disabled email", () => {
    const e2a = EMAILS.find((email) => email.id === "e2a")!;
    const wasEnabled = e2a.enabled;
    try {
      e2a.enabled = true;
      expect(pickId({ signupAt: ago(30) })).toBe("e2a");
      e2a.enabled = false;
      expect(pickId({ signupAt: ago(30) })).toBeNull();
    } finally {
      e2a.enabled = wasEnabled;
    }
  });
});

describe("pickEmail due rules", () => {
  it("e2a: 24-48h after signup with no activity, once", () => {
    expect(pickId({ signupAt: ago(23) })).toBeNull();
    expect(pickId({ signupAt: ago(24) })).toBe("e2a");
    expect(pickId({ signupAt: ago(47.9) })).toBe("e2a");
    expect(pickId({ signupAt: ago(48) })).toBeNull();
    expect(pickId({ signupAt: ago(49) })).toBeNull();
    expect(pickId({ signupAt: ago(30), activeDays: 1, firstActiveAt: ago(2), lastActiveAt: ago(2) })).toBeNull();
    expect(pickId({ signupAt: ago(47), sends: [sent("e2a", 25)] })).toBeNull();
  });

  it("e3a: 72-120h after signup with no activity, once", () => {
    expect(pickId({ signupAt: ago(71) })).toBeNull();
    expect(pickId({ signupAt: ago(72) })).toBe("e3a");
    expect(pickId({ signupAt: ago(119) })).toBe("e3a");
    expect(pickId({ signupAt: ago(120) })).toBeNull();
    expect(pickId({ signupAt: ago(100), sends: [sent("e3a", 25)] })).toBeNull();
  });

  const oneDay = (firstActive: number) => ({
    signupAt: ago(200),
    activeDays: 1,
    firstActiveAt: ago(firstActive),
    lastActiveAt: ago(firstActive),
  });

  it("e2b: 24-48h after first activity with exactly one active day, once", () => {
    expect(pickId(oneDay(23))).toBeNull();
    expect(pickId(oneDay(24))).toBe("e2b");
    expect(pickId(oneDay(47))).toBe("e2b");
    expect(pickId(oneDay(48))).toBeNull();
    expect(pickId({ ...oneDay(30), activeDays: 2 })).toBeNull();
    expect(pickId({ ...oneDay(60), sends: [sent("e2b", 30)] })).toBeNull();
  });

  it("activation emails never go to Pro users", () => {
    const pro = { tier: "pro" as const, proSince: ago(200) };
    expect(pickId({ ...pro, signupAt: ago(30) })).toBeNull();
    expect(pickId({ ...pro, signupAt: ago(80) })).toBeNull();
    expect(pickId({ ...oneDay(30), ...pro })).toBeNull();
    expect(pickId({ ...oneDay(100), ...pro })).toBeNull();
  });

  it("e3b: 96-168h after first activity with exactly one active day, once", () => {
    expect(pickId(oneDay(95))).toBeNull();
    expect(pickId(oneDay(96))).toBe("e3b");
    expect(pickId(oneDay(167))).toBe("e3b");
    expect(pickId(oneDay(168))).toBeNull();
    expect(pickId({ ...oneDay(100), sends: [sent("e3b", 30)] })).toBeNull();
  });

  it("c1: free user capped today, once", () => {
    const capped = { cappedToday: true, activeDays: 1, firstActiveAt: ago(1), lastActiveAt: ago(1) };
    expect(pickId(capped)).toBe("c1");
    expect(pickEmail(makeFacts(capped), NOW)?.dedupeKey).toBe("c1");
    expect(pickId({ ...capped, cappedToday: false })).toBeNull();
    expect(pickId({ ...capped, sends: [sent("c1", 30)] })).toBeNull();
  });

  it("c2: free, 48-120h after C1, once", () => {
    const base = { activeDays: 2, firstActiveAt: ago(200), lastActiveAt: ago(30) };
    expect(pickId({ ...base, sends: [sent("c1", 47)] })).toBeNull();
    expect(pickId({ ...base, sends: [sent("c1", 48)] })).toBe("c2");
    expect(pickId({ ...base, sends: [sent("c1", 119)] })).toBe("c2");
    expect(pickId({ ...base, sends: [sent("c1", 120)] })).toBeNull();
    expect(pickId({ ...base, sends: [sent("c1", 100), sent("c2", 50)] })).toBeNull();
    expect(pickId(base)).toBeNull();
  });

  const cappedAgain = (sends: EmailSendRecord[]) => ({
    cappedToday: true,
    activeDays: 4,
    firstActiveAt: ago(800),
    lastActiveAt: ago(1),
    sends: [sent("c1", 800), sent("c2", 750), ...sends],
  });

  it("c3: capped again after C2, 14 days apart, max 2 ever, dated dedupe key", () => {
    const picked = pickEmail(makeFacts(cappedAgain([])), NOW);
    expect(picked?.emailId).toBe("c3");
    expect(picked?.dedupeKey).toBe("c3:2026-10-15");

    expect(pickId({ ...cappedAgain([]), sends: [sent("c1", 800)] })).toBeNull();
    expect(pickId({ ...cappedAgain([]), cappedToday: false })).toBeNull();
    expect(pickId(cappedAgain([sent("c3", 14 * 24 - 1)]))).toBeNull();
    expect(pickId(cappedAgain([sent("c3", 14 * 24)]))).toBe("c3");
    expect(pickId(cappedAgain([sent("c3", 40 * 24), sent("c3", 20 * 24)]))).toBeNull();
  });

  it("c4: Pro, 72-168h after pro_since, once", () => {
    const pro = (hours: number) => ({ tier: "pro" as const, proSince: ago(hours) });
    expect(pickId(pro(71))).toBeNull();
    expect(pickId(pro(72))).toBe("c4");
    expect(pickId(pro(167))).toBe("c4");
    expect(pickId(pro(168))).toBeNull();
    expect(pickId({ ...pro(100), sends: [sent("c4", 25)] })).toBeNull();
  });

  it("c6: free, 1-24h after checkout started, 14 days apart, plan var", () => {
    const checkout = (hours: number) => ({ checkoutStartedAt: ago(hours), checkoutPlan: "annual" as const });
    expect(pickId(checkout(0.5))).toBeNull();
    const picked = pickEmail(makeFacts(checkout(1)), NOW);
    expect(picked).toMatchObject({ emailId: "c6", dedupeKey: "c6:2026-10-15", vars: { plan: "annual" } });
    expect(pickId(checkout(23.9))).toBe("c6");
    expect(pickId(checkout(24))).toBeNull();
    expect(pickId({ ...checkout(2), sends: [sent("c6", 13 * 24)] })).toBeNull();
    expect(pickId({ ...checkout(2), sends: [sent("c6", 14 * 24)] })).toBe("c6");
    expect(pickEmail(makeFacts({ ...checkout(2), checkoutPlan: null }), NOW)?.vars.plan).toBe("monthly");
  });

  it("r2: within 72h of the 3rd active day, once", () => {
    const third = (hours: number) => ({
      activeDays: 3,
      firstActiveAt: ago(200),
      thirdActiveAt: ago(hours),
      lastActiveAt: ago(hours),
    });
    expect(pickId(third(0))).toBe("r2");
    expect(pickId(third(71.9))).toBe("r2");
    expect(pickId(third(72))).toBeNull();
    expect(pickId({ ...third(10), activeDays: 2 })).toBeNull();
    expect(pickId({ ...third(10), sends: [sent("r2", 30)] })).toBeNull();
  });

  it("r1: 14-21 days after last activity with 2+ active days, 60 days apart", () => {
    const quiet = (days: number) => ({ activeDays: 2, firstActiveAt: ago(800), lastActiveAt: ago(days * 24) });
    expect(pickId(quiet(13.9))).toBeNull();
    const picked = pickEmail(makeFacts(quiet(14)), NOW);
    expect(picked).toMatchObject({ emailId: "r1", dedupeKey: "r1:2026-10-15", vars: { daysSince: 14 } });
    expect(pickEmail(makeFacts(quiet(20.5)), NOW)?.vars.daysSince).toBe(20);
    expect(pickId(quiet(21))).toBeNull();
    expect(pickId({ ...quiet(15), activeDays: 1 })).toBeNull();
    expect(pickId({ ...quiet(15), sends: [sent("r1", 59 * 24)] })).toBeNull();
    expect(pickId({ ...quiet(15), sends: [sent("r1", 60 * 24)] })).toBe("r1");
  });

  it("r3: Pro 30+ days or 5+ active days, 09:00-11:00 London only, once", () => {
    const inWindow = new Date("2026-10-15T09:00:00Z"); // 10:00 BST
    const proFor = (days: number) => ({ tier: "pro" as const, proSince: new Date(inWindow.getTime() - days * DAY) });
    expect(pickId(proFor(30), inWindow)).toBe("r3");
    expect(pickId(proFor(29.9), inWindow)).toBeNull();
    expect(pickId({ activeDays: 5 }, inWindow)).toBe("r3");
    expect(pickId({ activeDays: 4 }, inWindow)).toBeNull();
    expect(pickId({ activeDays: 5 }, NOW)).toBeNull(); // 13:00 London
    expect(pickId({ activeDays: 5, sends: [sent("r3", 30 * 24)] }, inWindow)).toBeNull();
  });

  it("picks the lowest priority number when several are due", () => {
    // c1 (20) and e2b (42) both due.
    expect(pickId({ ...oneDay(30), cappedToday: true, lastActiveAt: ago(1) })).toBe("c1");
  });
});

describe("pickEmail global caps", () => {
  const dueE2a = { signupAt: ago(30) };
  const dueC1 = { cappedToday: true, activeDays: 2, firstActiveAt: ago(800), lastActiveAt: ago(1) };

  it("blocks for 24h after any send, transactional included", () => {
    expect(pickId({ ...dueE2a, sends: [sent("x", 23.9)] })).toBeNull();
    expect(pickId({ ...dueE2a, sends: [sent("c5", 23.9, "transactional")] })).toBeNull();
    expect(pickId({ ...dueE2a, sends: [sent("c5", 24, "transactional")] })).toBe("e2a");
  });

  it("blocks after 4 marketing emails in 7 days", () => {
    const three = [sent("a", 25), sent("b", 3 * 24), sent("c", 5 * 24)];
    expect(pickId({ ...dueC1, sends: [...three, sent("d", 6.9 * 24)] })).toBeNull();
    expect(pickId({ ...dueC1, sends: [...three, sent("d", 7 * 24)] })).toBe("c1");
    expect(pickId({ ...dueC1, sends: [...three, sent("c5", 6 * 24, "transactional")] })).toBe("c1");
  });

  it("blocks after 4 unanswered marketing emails until the user is active again", () => {
    const old = [sent("a", 8 * 24), sent("b", 9 * 24), sent("c", 10 * 24), sent("d", 11 * 24)];
    expect(pickId({ ...dueC1, lastActiveAt: ago(12 * 24), sends: old })).toBeNull();
    expect(pickId({ ...dueC1, sends: old })).toBe("c1");
    // Never active: counted from signup.
    expect(pickId({ signupAt: ago(12 * 24), checkoutStartedAt: ago(2), sends: old })).toBeNull();
    expect(pickId({ signupAt: ago(12 * 24), checkoutStartedAt: ago(2), sends: old.slice(1) })).toBe("c6");
  });

  it("opted-out user gets nothing", () => {
    expect(pickId({ ...dueC1, emailOptOutAt: ago(100) })).toBeNull();
    expect(pickId({ ...dueE2a, emailOptOutAt: ago(1) })).toBeNull();
  });

  it("Pro user never gets c1, c2, c3 or c6", () => {
    const pro = {
      tier: "pro" as const,
      cappedToday: true,
      activeDays: 2,
      firstActiveAt: ago(800),
      lastActiveAt: ago(1),
      checkoutStartedAt: ago(2),
    };
    expect(pickId(pro)).toBeNull();
    expect(pickId({ ...pro, sends: [sent("c1", 60)] })).toBeNull();
    expect(pickId({ ...pro, sends: [sent("c1", 800), sent("c2", 750)] })).toBeNull();
  });

  it("free user never gets c4", () => {
    expect(pickId({ proSince: ago(100) })).toBeNull();
  });
});

describe("send windows", () => {
  const cases: Array<[string, "scheduled" | "r3" | "immediate", boolean]> = [
    // BST (UTC+1)
    ["2026-07-01T06:59:00Z", "scheduled", false],
    ["2026-07-01T07:00:00Z", "scheduled", true],
    ["2026-07-01T18:59:00Z", "scheduled", true],
    ["2026-07-01T19:00:00Z", "scheduled", false],
    ["2026-07-01T07:59:00Z", "r3", false],
    ["2026-07-01T08:00:00Z", "r3", true],
    ["2026-07-01T09:59:00Z", "r3", true],
    ["2026-07-01T10:00:00Z", "r3", false],
    // GMT (UTC+0)
    ["2026-12-01T07:59:00Z", "scheduled", false],
    ["2026-12-01T08:00:00Z", "scheduled", true],
    ["2026-12-01T19:59:00Z", "scheduled", true],
    ["2026-12-01T20:00:00Z", "scheduled", false],
    ["2026-12-01T08:59:00Z", "r3", false],
    ["2026-12-01T09:00:00Z", "r3", true],
    ["2026-12-01T11:00:00Z", "r3", false],
    ["2026-12-01T03:00:00Z", "immediate", true],
  ];

  it.each(cases)("%s %s -> %s", (iso, window, expected) => {
    expect(isInsideSendWindow(window, new Date(iso))).toBe(expected);
  });

  it("holds a scheduled email at 22:00 London but still sends an immediate one", () => {
    const night = new Date("2026-10-15T21:00:00Z"); // 22:00 BST
    const facts = { signupAt: new Date(night.getTime() - 30 * HOUR) };
    expect(pickId(facts, night)).toBeNull();
    expect(pickId({ ...facts, cappedToday: true, activeDays: 0 }, night)).toBe("c1");
  });
});

// Simulates the cron every 15 minutes, recording each pick as a send.
type Activity = { hour: number; capped?: boolean };
type Scenario = {
  signupAt: string;
  days: number;
  activity?: Activity[];
  tier?: "free" | "pro";
  proSinceHour?: number;
  firstQuestion?: string;
};

function simulate(scenario: Scenario): string[] {
  const start = new Date(scenario.signupAt).getTime();
  const at = (hour: number) => new Date(start + hour * HOUR);
  const sends: EmailSendRecord[] = [{ emailId: "e1", kind: "transactional", sentAt: at(0) }];
  if (scenario.proSinceHour !== undefined) {
    sends.push({ emailId: "c5", kind: "transactional", sentAt: at(scenario.proSinceHour) });
  }
  const picks: string[] = [];

  for (let t = start; t <= start + scenario.days * DAY; t += HOUR / 4) {
    const now = new Date(t);
    const done = (scenario.activity ?? []).filter((a) => at(a.hour) <= now);
    const today = now.toISOString().slice(0, 10);
    const isPro = scenario.proSinceHour !== undefined && at(scenario.proSinceHour) <= now;
    const facts = makeFacts({
      signupAt: new Date(start),
      tier: isPro ? "pro" : "free",
      activeDays: done.length,
      firstActiveAt: done[0] ? at(done[0].hour) : null,
      lastActiveAt: done.length > 0 ? at(done[done.length - 1].hour) : null,
      thirdActiveAt: done[2] ? at(done[2].hour) : null,
      cappedToday: done.some((a) => a.capped && at(a.hour).toISOString().slice(0, 10) === today),
      firstQuestion: scenario.firstQuestion ?? null,
      proSince: isPro ? at(scenario.proSinceHour!) : null,
      sends: [...sends],
    });
    const picked = pickEmail(facts, now);
    if (picked) {
      sends.push({ emailId: picked.emailId, kind: picked.kind, sentAt: now });
      picks.push(`${picked.emailId}@${(t - start) / HOUR}h`);
    }
  }
  return picks;
}

// Monday 09:00 BST.
const SIGNUP = "2026-10-12T08:00:00Z";

describe("user paths (spec §3)", () => {
  it("never asks: E2A at 24h, E3A at 72h, then nothing", () => {
    expect(simulate({ signupAt: SIGNUP, days: 25 })).toEqual(["e2a@24h", "e3a@72h"]);
  });

  it("asks once, never returns: E2B 24h and E3B 96h after the question", () => {
    expect(simulate({ signupAt: SIGNUP, days: 25, activity: [{ hour: 1 }] })).toEqual(["e2b@25h", "e3b@97h"]);
  });

  it("asks once, hits the limit, never returns: E1 blocks same-day C1", () => {
    expect(simulate({ signupAt: SIGNUP, days: 25, activity: [{ hour: 1, capped: true }] })).toEqual([
      "e2b@25h",
      "e3b@97h",
    ]);
  });

  it("comes back on a 2nd day: Flow 1 ends; R1 after 14 quiet days, held to 08:00 London", () => {
    // Last activity Tue 07:00 UTC; +14d lands on 07:00 GMT (after the clocks change), so R1 waits an hour.
    expect(simulate({ signupAt: SIGNUP, days: 40, activity: [{ hour: 1 }, { hour: 23 }] })).toEqual([
      "r1@360h",
    ]);
  });

  it("active on 5 days, then silent: R2 on day 3, R3 on day 5, R1 after 14 days", () => {
    const activity = [1, 25, 49, 73, 97].map((hour) => ({ hour }));
    expect(simulate({ signupAt: SIGNUP, days: 40, activity })).toEqual(["r2@49h", "r3@97h", "r1@433h"]);
  });

  it("hits the limit again after C2: C3, 14 days apart, max 2 ever", () => {
    const activity = [
      { hour: 1, capped: true },
      { hour: 73, capped: true }, // The first cap after E1's 24h gap: C1, then C2 at 121h.
      { hour: 409, capped: true }, // First C3 (wins over R2), R2 a day later.
      { hour: 745, capped: true }, // Exactly 14 days later: second C3.
    ];
    expect(simulate({ signupAt: SIGNUP, days: 40, activity })).toEqual([
      "e2b@25h",
      "c1@73h",
      "c2@121h",
      "c3@409h",
      "r2@433h",
      "c3@745h",
    ]);
  });

  it("becomes Pro: no activation emails, C4 at day 3, R3 after 30 days", () => {
    const picks = simulate({
      signupAt: SIGNUP,
      days: 35,
      activity: [{ hour: 1, capped: true }],
      proSinceHour: 2,
    });
    // Activation copy is about free limits, so Pro users skip E2B/E3B; C5 + C4 onboard them.
    expect(picks).toEqual(["c4@74h", "r3@722h"]);
  });

  it("signs up late evening: E2A waits for 08:00 London, still inside 24-48h", () => {
    // Signup 21:00 BST; 24h later is 21:00, so E2A goes 08:00 BST next day (+35h).
    expect(simulate({ signupAt: "2026-10-14T20:00:00Z", days: 10 })).toEqual(["e2a@35h", "e3a@83h"]);
  });

  it("never sends two emails within 24h or more than 4 in 7 days on any path", () => {
    const paths = [
      simulate({ signupAt: SIGNUP, days: 40, activity: [{ hour: 1, capped: true }, { hour: 30, capped: true }] }),
      simulate({ signupAt: SIGNUP, days: 40, activity: [1, 25, 49, 73, 97].map((hour) => ({ hour, capped: true })) }),
    ];
    for (const picks of paths) {
      const hours = picks.map((p) => Number(p.split("@")[1].replace("h", "")));
      hours.slice(1).forEach((h, i) => expect(h - hours[i]).toBeGreaterThanOrEqual(24));
      hours.forEach((h) => expect(hours.filter((x) => x > h - 7 * 24 && x <= h).length).toBeLessThanOrEqual(4));
    }
  });
});

describe("pickEmail vars", () => {
  it("e2b carries the topic as vars and variant; c2 carries the topic but no variant", () => {
    const e2b = pickEmail(
      makeFacts({
        displayName: null,
        activeDays: 1,
        firstActiveAt: ago(30),
        lastActiveAt: ago(30),
        firstQuestion: "Is FTMO legit?",
      }),
      NOW,
    );
    expect(e2b).toEqual({
      emailId: "e2b",
      dedupeKey: "e2b",
      kind: "marketing",
      priority: 42,
      variant: "propfirm",
      vars: { firstName: "there", topic: "propfirm" },
    });

    const c2 = pickEmail(
      makeFacts({
        activeDays: 2,
        firstActiveAt: ago(200),
        lastActiveAt: ago(30),
        firstQuestion: "gold outlook",
        sends: [sent("c1", 60)],
      }),
      NOW,
    );
    expect(c2).toMatchObject({ emailId: "c2", variant: null, vars: { firstName: "Sam", topic: "market" } });
  });
});

describe("classifyTopic", () => {
  it.each([
    ["Is this prop firm any good?", "propfirm"],
    ["How do FTMO payouts work", "propfirm"],
    ["Is Pepperstone FCA regulated?", "broker"],
    ["Best brokers for scalping?", "broker"],
    ["How much should I risk per trade?", "risk"],
    ["Stop loss at 1.0850, take profit at 1.0920", "risk"],
    ["How do I stop revenge trading", "psychology"],
    ["dealing with a losing streak", "psychology"],
    ["What is moving gold today", "market"],
    ["EURUSD long?", "market"],
    ["xauusd outlook", "market"],
    ["thoughts on eur/usd", "market"],
    ["When is NFP?", "market"],
    ["hello there", "other"],
    ["Is this unsafe?", "other"],
    ["fedex shares", "other"],
    ["", "other"],
    [null, "other"],
  ] as const)("%s -> %s", (text, expected) => {
    expect(classifyTopic(text)).toBe(expected);
  });

  it("first branch wins", () => {
    expect(classifyTopic("Does FTMO allow gold trading?")).toBe("propfirm");
    expect(classifyTopic("Is my broker safe for gold?")).toBe("broker");
  });
});

describe("firstNameFrom", () => {
  it("takes the first word or falls back to 'there'", () => {
    expect(firstNameFrom("  Sam   Trader ")).toBe("Sam");
    expect(firstNameFrom("Sam")).toBe("Sam");
    expect(firstNameFrom("   ")).toBe("there");
    expect(firstNameFrom("")).toBe("there");
    expect(firstNameFrom(null)).toBe("there");
  });
});

describe("factsFromRow", () => {
  it("camelCases, parses dates and normalises tier, plan and nulls", () => {
    const facts = factsFromRow({
      user_id: "u1",
      email: "a@b.com",
      display_name: "Ann",
      tier: "pro",
      signup_at: "2026-10-01T10:00:00Z",
      email_opt_out_at: null,
      first_active_at: "2026-10-01T11:00:00.000Z",
      last_active_at: "2026-10-03T11:00:00+00:00",
      active_days: 2,
      third_active_at: null,
      capped_today: true,
      first_question: "gold?",
      pro_since: null,
      checkout_started_at: "2026-10-04T09:00:00Z",
      checkout_plan: "annual",
      sends: [{ email_id: "e2b", dedupe_key: "e2b", kind: "marketing", sent_at: "2026-10-02T11:00:00Z" }],
    });
    expect(facts).toEqual({
      userId: "u1",
      email: "a@b.com",
      displayName: "Ann",
      tier: "pro",
      signupAt: new Date("2026-10-01T10:00:00Z"),
      emailOptOutAt: null,
      firstActiveAt: new Date("2026-10-01T11:00:00Z"),
      lastActiveAt: new Date("2026-10-03T11:00:00Z"),
      activeDays: 2,
      thirdActiveAt: null,
      cappedToday: true,
      firstQuestion: "gold?",
      proSince: null,
      checkoutStartedAt: new Date("2026-10-04T09:00:00Z"),
      checkoutPlan: "annual",
      sends: [{ emailId: "e2b", kind: "marketing", sentAt: new Date("2026-10-02T11:00:00Z") }],
    });
  });

  it("defaults unknown tier to free, unknown plan to null, null sends to []", () => {
    const facts = factsFromRow({
      user_id: "u2",
      email: "c@d.com",
      display_name: null,
      tier: "enterprise",
      signup_at: "2026-10-01T10:00:00Z",
      email_opt_out_at: "2026-10-05T10:00:00Z",
      first_active_at: null,
      last_active_at: null,
      active_days: 0,
      third_active_at: null,
      capped_today: false,
      first_question: null,
      pro_since: null,
      checkout_started_at: null,
      checkout_plan: "lifetime",
      sends: null,
    });
    expect(facts.tier).toBe("free");
    expect(facts.checkoutPlan).toBeNull();
    expect(facts.sends).toEqual([]);
    expect(facts.emailOptOutAt).toEqual(new Date("2026-10-05T10:00:00Z"));
    expect(facts.firstActiveAt).toBeNull();
  });
});
