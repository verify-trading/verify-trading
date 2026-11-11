/** Live Ask regression batch (43 client-bank questions): generic quality gates on every answer. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { appendFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AskResponseCard } from "@/components/ask/cards";
import { loadDotEnvLocal } from "./env-local";

loadDotEnvLocal();

type Turn = { role: "user" | "assistant"; content: string };
const ask = (question: string, history: Turn[] = []) => ({ question, history });
const clarify = (first: string) => [
  { role: "user" as const, content: first },
  { role: "assistant" as const, content: JSON.stringify({ type: "insight", headline: "Let's Find One That Fits", body: "It depends on where you live and what you trade.", verdict: "Which country are you in, and what do you mainly trade?" }) },
];

const cases = [
  ask("Is Exness a safe and trustworthy broker for a trader in South Africa?"),
  ask("Which is safer, Pepperstone or Vantage, and why?"),
  ask("How is TradeZella?"),
  ask("Is TrendSpider worth paying for?"),
  ask("I need a new broker. Which one is best?"),
  ask("Is TMGM safe for a new trader?"),
  ask("Is FTMO worth it for my first funded account?"),
  ask("Why does this trader say Unverified? Is he a scammer?"),
  ask("What does a pip mean?"),
  ask("Do prop firms give real money or demo accounts?"),
  ask("This app wants my MT5 master password to track trades. Is that okay?"),
  ask("I lost three trades today. Should I trade again to make it back?"),
  ask("Does a 90% win rate prove a trader is profitable?"),
  ask("Does a prop firm score of 100 mean payouts are guaranteed?"),
  ask("I am short GBP/USD at 1.3000, stop 1.3040, target 1.2920. What is the gross risk reward?"),
  ask("I am buying gold at 4000 with stop 4020 and target 3960. Are these buy levels valid?"),
  ask("No reviews exist for this unnamed broker. Does that prove it is a scam?"),
  ask("I've only got \u00a3200 and I'm new to trading. Is that enough to start?"),
  ask("I'm new. Is 1:500 leverage good?"),
  ask("Why is gold going down?"),
  ask("Can you analyse gold before the London session?"),
  ask("H4 is bullish but the 15-minute chart is bearish. Which one do I follow?"),
  ask("I can't see any decent setups on EUR/USD today. Should I just take one anyway?"),
  ask("I've got \u00a3200 and want to risk \u00a32 on gold. My stop is $10 away. What lot size?"),
  ask("Should I move my stop loss to break even as soon as I'm in profit?"),
  ask("US CPI is out tomorrow. Should I avoid EUR/USD?"),
  ask("What's the best broker for gold?"),
  ask("Is Pepperstone safe for UK retail CFDs?"),
  ask("Is Alpari legit or should I stay away?"),
  ask("Exness or IC Markets \u2014 which is better for me?"),
  ask("This broker says it's FCA regulated but the website looks different. Is that normal?"),
  ask("My broker says I have to pay a tax before they'll release my withdrawal. Is that normal?"),
  ask("Does FundedNext actually pay traders?"),
  ask("I passed my funded challenge but they still won't pay me. Can they do that?"),
  ask("Topstep or Tradeify? I trade futures and can't decide."),
  ask("Is TradingView safe to use?"),
  ask("This AI trading bot promises 10% profit every month. Is it legit?"),
  ask("Should I use MetaTrader 5 or TradingView?"),
  ask("This guy has a million followers. Should I buy his trading course?"),
  ask("My trading mentor wants to log into my broker and trade for me. Is that normal?"),
  ask("Has this forex influencer ever been warned by the FCA?"),
  ask("Morocco. Gold scalping on MT5. Withdrawals matter most.", clarify("I need a new broker.")),
  ask("UK, mostly forex and a bit of gold.", clarify("I'm looking for a decent broker.")),
];

describe.skipIf(process.env.RUN_ASK_SMOKE !== "1")("Ask regression batch, live", () => {
  for (const testCase of cases.filter((item) => !process.env.ASK_SMOKE_FILTER || item.question.toLowerCase().includes(process.env.ASK_SMOKE_FILTER.toLowerCase()))) {
    it(testCase.question, async () => {
      const { generateAskResponse } = await import("@/lib/ask/pipeline");
      const result = await generateAskResponse({ message: testCase.question, history: testCase.history });
      const html = renderToStaticMarkup(createElement(AskResponseCard, { card: result.data, uiMeta: result.uiMeta }));
      const text = JSON.stringify(result.data);
      appendFileSync(process.env.ASK_SMOKE_OUT ?? "/private/tmp/ask-regression.jsonl", JSON.stringify({ q: testCase.question, card: result.data, uiMeta: result.uiMeta }) + "\n");
      expect(html).not.toMatch(/NaN|undefined|\[object Object\]/);
      expect(text).not.toMatch(/\*\*|Quick Take|Need Input|No additional detail|<\/?cite|"lots":"0\.00"/);
      expect((result.uiMeta?.followups ?? []).length).toBeLessThanOrEqual(3);
    }, 240_000);
  }
});
