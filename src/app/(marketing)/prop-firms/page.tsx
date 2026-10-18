import type { Metadata } from "next";

import { BusinessPage } from "@/components/marketing/business-page";
import { PAGE_FAQS } from "@/lib/marketing/faqs";
import { pageMetadata } from "@/lib/marketing/seo";

const path = "/prop-firms";
const description =
  "How prop firms are assessed on verify.trading, how to request a correction to your record, and our independence policy: no paid placement or commissions.";

export const metadata: Metadata = pageMetadata({ title: "For Prop Firms: How You Are Assessed", description, path });

export default function PropFirmsPage() {
  return (
    <BusinessPage
      path={path}
      name="For Prop Firms"
      description={description}
      eyebrow="For prop firms"
      title={<>How verify.trading assesses <span className="text-[var(--vt-coral)]">prop firms.</span></>}
      lede="Traders check a firm before they buy a challenge. This page explains what a prop firm record is built from, how to ask for a correction, and why the outcome is not for sale."
      compareHref="/compare/prop-firms"
      compareLabel="Compare Prop Firms"
      entityNoun="prop firm"
      faqs={[...PAGE_FAQS.propFirmsBusiness]}
      assessed={[
        { title: "Operating status", body: "Whether a firm is operating, closed or still being monitored. Records not yet scored show as “Not yet rated”." },
        { title: "Published terms", body: "Your own published rules, payout terms and licensing claims, as they appear on your site." },
        { title: "Documented complaint patterns", body: "Public, attributable records of withdrawal and payout issues, assessed for pattern and not for isolated reports." },
      ]}
    />
  );
}
