import type { Metadata } from "next";

import { RegulatorsIndex } from "@/components/marketing/regulator-views";
import { getPublicEntities } from "@/lib/compare/entities";
import { regulatorHubs } from "@/lib/compare/insights";
import { pageMetadata } from "@/lib/marketing/seo";

export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: "Broker Regulators: What a Licence Means and How to Check It",
  description: "Every regulator in our broker register: what it is, the client protection it gives, how to check its register, and the brokers that list it.",
  path: "/regulators",
});

export default async function Page() {
  const brokers = await getPublicEntities("broker");
  return <RegulatorsIndex hubs={regulatorHubs(brokers)} total={brokers.length} />;
}
