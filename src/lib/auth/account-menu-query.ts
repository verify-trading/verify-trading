import type { SupabaseClient } from "@supabase/supabase-js";

import { loadAskUsageState } from "@/lib/rate-limit/load-ask-usage";
import type { FreeAskUsageSummary } from "@/lib/rate-limit/usage";

export type AccountMenuProfile = {
  display_name: string | null;
  username: string | null;
  tier: string;
};

export type AccountMenuState = {
  profile: AccountMenuProfile | null;
  usage: FreeAskUsageSummary | null;
};

export function getAccountMenuQueryKey(userId: string) {
  return ["account-menu", userId] as const;
}

export async function loadAccountMenuState(
  supabase: SupabaseClient,
  userId: string,
): Promise<AccountMenuState> {
  const [profileResult, usageState] = await Promise.all([
    supabase.from("profiles").select("display_name, username, tier").eq("id", userId).maybeSingle(),
    loadAskUsageState(supabase, userId),
  ]);

  return {
    profile: profileResult.error
      ? null
      : profileResult.data
        ? (profileResult.data as AccountMenuProfile)
        : null,
    usage: usageState.tier === "free" ? usageState.usage : null,
  };
}
