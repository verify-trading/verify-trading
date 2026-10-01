import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { VsView } from "@/components/marketing/vs-view";
import { getPublicEntities } from "@/lib/compare/entities";
import { isIndexable, isIndexedPair, pairKey } from "@/lib/compare/insights";
import { pageMetadata } from "@/lib/marketing/seo";

export const revalidate = 3600;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string; other: string }> };

async function load(slug: string, other: string) {
  const brokers = await getPublicEntities("broker");
  const a = brokers.find((e) => e.slug === slug);
  const b = brokers.find((e) => e.slug === other);
  return { brokers, a, b };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, other } = await params;
  const { brokers, a, b } = await load(slug, other);
  if (!a || !b || a.slug === b.slug) return { title: "Not found", robots: { index: false } };
  const [x, y] = pairKey(a.slug, b.slug);
  const meta = pageMetadata({
    title: `${a.name} vs ${b.name}: Regulation and Verdict Compared`,
    description: `${a.name} (${a.verdict}) against ${b.name} (${b.verdict}): regulators, FCA status, score and record basis side by side, from public records.`.slice(0, 160),
    path: `/compare/brokers/${x}/vs/${y}`,
  });
  return isIndexedPair(brokers, x, y) && isIndexable(a) && isIndexable(b) ? meta : { ...meta, robots: { index: false, follow: true } };
}

export default async function Page({ params }: Props) {
  const { slug, other } = await params;
  const { a, b } = await load(slug, other);
  if (!a || !b || a.slug === b.slug) notFound();
  const [x, y] = pairKey(a.slug, b.slug);
  if (x !== slug) permanentRedirect(`/compare/brokers/${x}/vs/${y}`);
  return <VsView a={a} b={b} />;
}
