import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EntityDetail } from "@/components/marketing/entity-detail";
import { getPublicEntities, getPublicEntityRecord } from "@/lib/compare/entities";
import { listableEntities } from "@/lib/compare/insights";
import { entityMetadata } from "@/lib/compare/page-meta";
import { compareStaticParams } from "@/lib/compare/static-params";

// Prebuilt at production build time (every record + curated vs page) so a fresh deploy never
// serves the register cold; revalidated at most daily after that (hourly burned ISR writes). Preview/CI builds
// skip the prebuild and render on first request as before.
export const revalidate = 86400;
export const generateStaticParams = () => compareStaticParams("guru");

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return entityMetadata("guru", (await params).slug);
}

export default async function Page({ params }: Props) {
  const entity = await getPublicEntityRecord("guru", (await params).slug);
  if (!entity) notFound();
  return <EntityDetail entity={entity} all={listableEntities(await getPublicEntities("guru"))} />;
}
