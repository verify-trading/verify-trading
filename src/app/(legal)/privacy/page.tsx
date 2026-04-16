import type { Metadata } from "next";

import { LegalDocument } from "@/components/legal/legal-document";
import { getAppName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `Privacy policy for ${getAppName()}.`,
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Privacy Policy"
      summary="This policy describes how we handle personal data. Replace placeholder copy with counsel-reviewed language before taking paid users or scaling traffic."
      sections={[
        {
          title: "Overview",
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
