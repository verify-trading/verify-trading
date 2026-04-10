import { GuidePageClient } from "@/components/guide/guide-page-client";
import { requireSession } from "@/lib/auth/session";

export default async function GuidePage() {
  await requireSession("/guide");

  return <GuidePageClient />;
}
