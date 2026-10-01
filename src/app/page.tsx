import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/landing-page";
import { JsonLd } from "@/components/seo/json-ld";
import { getHeroGoldBriefing } from "@/lib/landing/hero-gold";
import { softwareApplicationSchema } from "@/lib/seo/schema";
import { getAppName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: { absolute: `${getAppName()} | AI trading second opinion` },
  description:
    "Verify brokers and prop firms against regulator records, check your trades and risk, and get an AI second opinion — before you place the trade.",
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
