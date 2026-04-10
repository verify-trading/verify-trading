import type { Metadata } from "next";

import { LegalDocument } from "@/components/legal/legal-document";
import { getAppName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Risk Disclosure",
  description: `Trading risk disclosure for ${getAppName()}.`,
};

export default function RiskDisclosurePage() {
  return (
    <LegalDocument
      eyebrow="Risk"
      title="Risk Disclosure"
      summary="Trading and leveraged products carry significant risk. This page sets expectations for educational use of the product. Have it reviewed for your jurisdiction and product roadmap."
      sections={[
        {
          title: "Trading risk",
          paragraphs: [
            "Trading forex, CFDs, futures, crypto, and other leveraged products involves substantial risk and is not suitable for everyone. Losses can exceed deposits where leverage or margin applies.",
            "Past performance, chart examples, educational setups, and AI-generated analysis do not guarantee future results.",
          ],
        },
        {
          title: "Educational content only",
          paragraphs: [
            `Content in ${getAppName()} is for educational and informational purposes. It is not investment advice, a financial promotion, or a recommendation to enter any trade.`,
            "Users should obtain independent advice and make their own decisions based on their financial situation, experience, and risk tolerance.",
          ],
        },
        {
          title: "Your responsibility",
          paragraphs: [
            "Users remain responsible for position sizing, order execution, broker selection, tax obligations, and compliance with applicable laws and regulations.",
            "If the product adds signals, subscriptions, or affiliate relationships, update this disclosure to describe those activities clearly.",
          ],
        },
      ]}
    />
  );
}
