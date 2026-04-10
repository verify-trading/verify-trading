import type { Metadata } from "next";

import { LegalDocument } from "@/components/legal/legal-document";
import { getAppName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Terms of Use & Privacy",
  description: `Terms of use and privacy policy for ${getAppName()}.`,
};

export default function TermsPage() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Terms of Use & Privacy Policy"
      summary="These terms govern your use of the service, and the privacy section explains how we handle personal data. Replace placeholder copy with counsel-reviewed language before taking paid users or scaling traffic."
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
        {
          id: "privacy",
          title: "Privacy Policy",
          paragraphs: [
            "This section describes what we may collect and why. Expand it with your legal adviser so it matches your vendors (e.g. auth, database, analytics), retention, and regional requirements.",
          ],
        },
        {
          title: "Data collected",
          paragraphs: [
            "The app may collect account details such as email address, authentication identifiers, plan tier, usage metrics, saved sessions, and support messages.",
            "Product interactions may also generate technical information such as device or browser details, timestamps, and basic usage events needed for security, billing, and product improvement.",
          ],
        },
        {
          title: "How data is used",
          paragraphs: [
            "Data is used to authenticate users, deliver product features, enforce free-plan limits, improve answer quality, investigate abuse, and communicate operational updates.",
            "If analytics or marketing tools are added later, this policy should be updated to explain what is tracked, why, and how users can opt out where required.",
          ],
        },
        {
          title: "Storage and your rights",
          paragraphs: [
            "User data is stored with infrastructure providers required to run the service, including authentication and database vendors. Access should be limited to authorised operators and processors acting on your behalf.",
            "Before launch, add retention periods, deletion workflow, a contact email, and any regional rights language required for GDPR, UK GDPR, CCPA, or other applicable laws.",
          ],
        },
      ]}
    />
  );
}
