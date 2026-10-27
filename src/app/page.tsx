import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/landing-page";
import { JsonLd } from "@/components/seo/json-ld";
import { getHeroGoldBriefing } from "@/lib/landing/hero-gold";
import { softwareApplicationSchema } from "@/lib/seo/schema";
import { getAppName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: { absolute: `Broker & Prop Firm Checks. AI Tools | ${getAppName()}` },
  description:
    "Look beyond the promises. Check brokers and prop firms with independent, sourced records. Explore AI trade analysis, market insights and risk tools.",
  alternates: { canonical: "/" },
};

export default async function Home() {
  const liveGold = await getHeroGoldBriefing();
  return (
    <>
      <JsonLd data={softwareApplicationSchema()} />
      <LandingPage liveGold={liveGold} />
    </>
  );
}
