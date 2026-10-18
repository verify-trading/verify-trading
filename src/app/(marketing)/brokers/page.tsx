import type { Metadata } from "next";

import { BusinessPage } from "@/components/marketing/business-page";
import { PAGE_FAQS } from "@/lib/marketing/faqs";
import { pageMetadata } from "@/lib/marketing/seo";

const path = "/brokers";
const description =
  "How brokers are assessed on verify.trading, how to request a correction to your record, and our independence policy: no paid placement or affiliate commissions.";

export const metadata: Metadata = pageMetadata({ title: "For Brokers: How You Are Assessed", description, path });

export default function BrokersPage() {
  return (
    <BusinessPage
      path={path}
      name="For Brokers"
      description={description}
      eyebrow="For brokers"
      title={<>How verify.trading assesses <span className="text-[var(--vt-coral)]">brokers.</span></>}
      lede="Traders check us before they deposit with you. This page explains what a broker record is built from, how to ask for a correction, and why the outcome is not for sale."
      compareHref="/compare/brokers"
      compareLabel="Compare Brokers"
      entityNoun="broker"
      faqs={[...PAGE_FAQS.brokers]}
      assessed={[
        { title: "Regulatory status", body: "Public registers and warning lists, such as the FCA register and unauthorised-firm warnings, and equivalent authorities elsewhere." },
        { title: "Licences and terms", body: "The regulators you list, the entity that serves the client, and your own published rules on leverage and licensing." },
        { title: "Documented actions", body: "Court actions, sanctions and regulatory decisions from official sources, with the citation shown on the record." },
      ]}
    />
  );
}
