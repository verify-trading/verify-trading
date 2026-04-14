import { redirect } from "next/navigation";

import { MarketsPage } from "@/components/markets/markets-page";
import { getSessionUser } from "@/lib/auth/session";
import { getPricingPageData } from "@/lib/billing/pricing-page-data";

type ProfileTierRow = {
  tier: string | null;
};

export default async function MarketsRoute() {
  const session = await getSessionUser();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent("/markets")}`);
  }

  const profileResult = await session.supabase
    .from("profiles")
    .select("tier")
    .eq("id", session.user.id)
    .maybeSingle();

  const initialTier: "pro" | "free" =
    !profileResult.error && (profileResult.data as ProfileTierRow | null)?.tier === "pro" ? "pro" : "free";

  const { pricing, billingContext } = await getPricingPageData();

  return <MarketsPage initialTier={initialTier} pricing={pricing} billingContext={billingContext} />;
}
