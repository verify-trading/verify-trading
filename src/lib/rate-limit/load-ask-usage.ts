import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getFreeAskUsageSummary,
  getTodayUtcDateString,
  type FreeAskUsageSummary,
} from "@/lib/rate-limit/usage";

type ProfileTierRow = {
  tier: string | null;
};

type UsageRow = {
  query_count: number | null;
};

export type AskUsageState = {
  tier: "free" | "pro";
  usage: FreeAskUsageSummary | null;
  isExhausted: boolean;
};

export async function loadAskUsageState(
  supabase: SupabaseClient,
  userId: string,
): Promise<AskUsageState> {
  const [profileResult, usageResult] = await Promise.all([
    supabase.from("profiles").select("tier").eq("id", userId).maybeSingle(),
    supabase
      .from("usage_limits")
      .select("query_count")
      .eq("user_id", userId)
      .eq("usage_date", getTodayUtcDateString())
      .maybeSingle(),
  ]);

  const tier = (profileResult.data as ProfileTierRow | null)?.tier === "pro" ? "pro" : "free";

  if (tier === "pro") {
    return {
      tier,
      usage: null,
      isExhausted: false,
    };
  }

  const usage = getFreeAskUsageSummary((usageResult.data as UsageRow | null)?.query_count);

  return {
    tier,
    usage,
    isExhausted: usage.remaining === 0,
  };
}
