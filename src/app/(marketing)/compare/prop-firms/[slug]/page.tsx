import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EntityDetail } from "@/components/marketing/entity-detail";
import { getPublicEntities, getPublicEntity } from "@/lib/compare/entities";
import { entityMetadata } from "@/lib/compare/page-meta";

// Rendered on first request, then cached and revalidated hourly (no build-time DB dependency).
export const revalidate = 3600;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return entityMetadata("propfirm", (await params).slug);
}

export default async function Page({ params }: Props) {
  const entity = await getPublicEntity("propfirm", (await params).slug);
  if (!entity) notFound();
  return <EntityDetail entity={entity} all={await getPublicEntities("propfirm")} />;
}
