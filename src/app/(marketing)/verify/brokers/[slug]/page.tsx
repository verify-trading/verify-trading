import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EntityDetail } from "@/components/marketing/entity-detail";
import { getEntityCountryRows } from "@/lib/compare/bts-data";
import { getPublicEntities, getPublicEntity } from "@/lib/compare/entities";
import { listableEntities } from "@/lib/compare/insights";
import { entityMetadata } from "@/lib/compare/page-meta";

// Rendered on first request, then cached and revalidated hourly (no build-time DB dependency).
export const revalidate = 3600;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return entityMetadata("broker", (await params).slug);
}

export default async function Page({ params }: Props) {
  const entity = await getPublicEntity("broker", (await params).slug);
  if (!entity) notFound();
  // All ~67 country rows ship with the cached page; the visitor's country is picked client-side.
  const countryRows = entity.bts ? await getEntityCountryRows(entity.bts.entityId) : [];
  return <EntityDetail entity={entity} all={listableEntities(await getPublicEntities("broker"))} countryRows={countryRows} />;
}
