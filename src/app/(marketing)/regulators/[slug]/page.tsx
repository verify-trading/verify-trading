import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isUniqueCode, RegulatorHub } from "@/components/marketing/regulator-views";
import { getPublicEntities } from "@/lib/compare/entities";
import { hubFor, hubIndexable, regulatorHubs } from "@/lib/compare/insights";
import { getRegulator } from "@/lib/compare/regulators";
import { pageMetadata } from "@/lib/marketing/seo";

export const revalidate = 3600;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug;
  const reg = getRegulator(slug);
  if (!reg) return { title: "Not found", robots: { index: false } };
  const hub = hubFor(await getPublicEntities("broker"), slug);
  const n = hub?.entities.length ?? 0;
  const meta = pageMetadata({
    title: `${reg.code} Regulated Brokers: List, Protection and Verdicts`,
    description: `${n} brokers list ${reg.name} (${reg.code}) in our register. What ${reg.code} protects, how to check its register, and each broker's verdict.`.slice(0, 160),
    path: `/regulators/${slug}`,
  });
  return hub && hubIndexable(hub) ? meta : { ...meta, robots: { index: false, follow: true } };
}

export default async function Page({ params }: Props) {
  const slug = (await params).slug;
  const reg = getRegulator(slug);
  if (!reg) notFound();
  const hubs = regulatorHubs(await getPublicEntities("broker"));
  const hub = hubs.find((h) => h.regulator.slug === slug)!;
  const others = hubs.filter((h) => h.regulator.standing === reg.standing && h.regulator.slug !== slug && h.entities.length > 0).sort((a, b) => b.entities.length - a.entities.length).slice(0, 8);
  return <RegulatorHub hub={hub} uniqueCode={isUniqueCode(reg.code)} others={others} />;
}
