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

export type LoadAskUsageOptions = {
  /** When set, skips reading `profiles` for tier (caller already loaded the row). */
  profileTier?: string | null;
};

export async function loadAskUsageState(
  supabase: SupabaseClient,
  userId: string,
  options?: LoadAskUsageOptions,
): Promise<AskUsageState> {
  let tier: "free" | "pro";

  if (options?.profileTier !== undefined) {
    tier = options.profileTier === "pro" ? "pro" : "free";
  } else {
    const profileResult = await supabase.from("profiles").select("tier").eq("id", userId).maybeSingle();
    tier = (profileResult.data as ProfileTierRow | null)?.tier === "pro" ? "pro" : "free";
  }

  if (tier === "pro") {
    return {
      tier,
      usage: null,
      isExhausted: false,
    };
  }

  const usageResult = await supabase
    .from("usage_limits")
    .select("query_count")
    .eq("user_id", userId)
    .eq("usage_date", getTodayUtcDateString())
    .maybeSingle();

  const usage = getFreeAskUsageSummary((usageResult.data as UsageRow | null)?.query_count);

  return {
    tier,
    usage,
    isExhausted: usage.remaining === 0,
  };
}
