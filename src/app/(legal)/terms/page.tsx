import type { Metadata } from "next";

import { LegalDocument } from "@/components/legal/legal-document";
import { getAppName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: `Terms of use for ${getAppName()}.`,
};

export default function TermsPage() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Terms of Use"
      summary="These terms govern your use of the service. Replace placeholder copy with counsel-reviewed language before taking paid users or scaling traffic. Our privacy policy describes how we handle personal data."
      sections={[
        {
          title: "Service scope",
          paragraphs: [
            `${getAppName()} provides educational market commentary, calculators, and structured trading guidance. It does not execute trades, manage user capital, or provide personalised financial advice.`,
            "Users remain fully responsible for how they interpret and act on any content shown in the app, including guides, chat answers, and calculator outputs.",
          ],
        },
        {
          title: "Accounts and acceptable use",
          paragraphs: [
            "Users must provide accurate signup details and keep login credentials secure. Sharing access, scraping the product, abusing rate limits, or attempting to reverse engineer protected systems may result in account suspension.",
            "Plan limits, access rules, and product features may change over time, including free-plan usage limits and access to premium tools.",
          ],
        },
        {
          title: "No guarantees",
          paragraphs: [
            "Market data, educational examples, and AI-generated outputs may be incomplete, delayed, or incorrect. No outcome, profitability level, or account growth result is guaranteed.",
            "The service is provided on an as-is basis without warranties of uninterrupted availability, trading suitability, or fitness for a particular purpose.",
          ],
        },
      ]}
    />
  );
}
