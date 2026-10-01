import type { Metadata } from "next";

import { RiskRewardCalculator } from "@/components/marketing/tool-calculators";
import { ToolPage } from "@/components/marketing/tool-page";
import { PAGE_FAQS } from "@/lib/marketing/faqs";
import { pageMetadata } from "@/lib/marketing/seo";

const path = "/tools/risk-reward-calculator";
const description =
  "Free risk to reward calculator: enter entry, stop loss and take profit to get the ratio, the distances in pips and the break-even win rate. Long and short trades.";

export const metadata: Metadata = pageMetadata({ title: "Risk to Reward Ratio Calculator", description, path });

export default function Page() {
  return (
    <ToolPage
      path={path}
      name="Risk to Reward Calculator"
      description={description}
      h1={<>Risk to reward calculator: <span className="text-[var(--vt-coral)]">what a win pays against a loss.</span></>}
      lede="Enter your entry, stop and target to see the ratio, the distances in pips and the win rate you need just to break even. Free and instant."
      calculator={<RiskRewardCalculator />}
      formulaTitle="Ratio = reward distance / risk distance"
      formula="R:R = |Target - Entry| / |Entry - Stop|     Break-even win rate = 1 / (1 + R:R)"
      workedExample={[
        "Long EUR/USD. Entry 1.0850, stop 1.0820, target 1.0940.",
        "Risk = 30 pips. Reward = 90 pips. Ratio = 90 / 30 = 1:3.",
        "Break-even win rate = 1 / (1 + 3) = 25% before spread and commission.",
        "At 1:1 you would need to win 50% of trades just to break even.",
      ]}
      faqs={[...PAGE_FAQS.tools.riskReward]}
    />
  );
}
