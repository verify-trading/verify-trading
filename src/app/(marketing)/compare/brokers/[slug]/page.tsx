import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { EntityDetail } from "@/components/marketing/entity-detail";
import { VsView, vsSummary } from "@/components/marketing/vs-view";
import { getOfficialAssessment } from "@/lib/compare/bts-l2";
import { getPublicEntities, getPublicEntity } from "@/lib/compare/entities";
import { listableEntities, parseVsPair } from "@/lib/compare/insights";
import { entityMetadata } from "@/lib/compare/page-meta";
import { resolveVsPage } from "@/lib/compare/vs-page";
import { pageMetadata } from "@/lib/marketing/seo";

// One dynamic segment serves both /compare/brokers/<slug> (entity record) and
// /compare/brokers/<a>-vs-<b> (side-by-side page): Next.js allows only one
// dynamic folder per level, so the "-vs-" shape decides which page renders.
// Rendered on first request, then cached and revalidated hourly (no build-time DB dependency).
export const revalidate = 3600;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (parseVsPair(slug)) {
    const res = await resolveVsPage("broker", slug);
    if (res.kind !== "ok") return { title: "Not found", robots: { index: false } };
    const meta = pageMetadata({
      title: `${res.a.name} vs ${res.b.name}: verdicts compared`,
      description: vsSummary(res.a, res.b),
      path: res.canonical,
    });
    return res.indexed ? meta : { ...meta, robots: { index: false, follow: true } };
  }
  return entityMetadata("broker", slug);
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  if (parseVsPair(slug)) {
    const res = await resolveVsPage("broker", slug);
    if (res.kind === "redirect") permanentRedirect(res.to);
    if (res.kind === "notFound") notFound();
    return <VsView a={res.a} b={res.b} />;
  }
  const entity = await getPublicEntity("broker", slug);
  if (!entity) notFound();
  const official = entity.scoreBasis === "official" && entity.bts ? await getOfficialAssessment(entity.bts.entityId) : null;
  return <EntityDetail entity={entity} all={listableEntities(await getPublicEntities("broker"))} official={official} />;
}
