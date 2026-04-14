import type { QueryClient, UseQueryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";

import { loadAskUsageState } from "@/lib/rate-limit/load-ask-usage";
import type { FreeAskUsageSummary } from "@/lib/rate-limit/usage";

export type AccountMenuProfile = {
  display_name: string | null;
  username: string | null;
  tier: string;
  created_at: string;
  preferences: Record<string, unknown> | null;
};

export type AccountMenuState = {
  profile: AccountMenuProfile | null;
  usage: FreeAskUsageSummary | null;
};

export function getAccountMenuQueryKey(userId: string) {
  return ["account-menu", userId] as const;
}

export type AccountMenuQueryKey = ReturnType<typeof getAccountMenuQueryKey>;

/**
 * Single definition for server prefetch, `useQuery`, and any future consumers.
 * `queryFn` is only safe to run when `enabled` is true (or when prefetching with a real session).
 */
export function getAccountMenuQueryOptions(
  supabase: SupabaseClient | null,
  userId: string | undefined,
): Pick<UseQueryOptions<AccountMenuState, Error>, "queryKey" | "queryFn" | "enabled"> {
  return {
    queryKey: getAccountMenuQueryKey(userId ?? ""),
    queryFn: () => {
      if (!supabase || !userId) {
        throw new Error("account-menu: loadAccountMenuState called without supabase and user id");
      }
      return loadAccountMenuState(supabase, userId);
    },
    enabled: Boolean(supabase && userId),
  };
}

export async function prefetchAccountMenuForSession(
  queryClient: QueryClient,
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { queryKey, queryFn } = getAccountMenuQueryOptions(supabase, userId);
  await queryClient.prefetchQuery({ queryKey, queryFn });
}

export async function loadAccountMenuState(
  supabase: SupabaseClient,
  userId: string,
): Promise<AccountMenuState> {
  const profileResult = await supabase
    .from("profiles")
    .select("display_name, username, tier, created_at, preferences")
    .eq("id", userId)
    .maybeSingle();

  const profileRow = profileResult.error
    ? null
    : profileResult.data
      ? (profileResult.data as AccountMenuProfile)
      : null;

  const usageState = await loadAskUsageState(supabase, userId, {
    profileTier: profileRow?.tier,
  });

  return {
    profile: profileRow,
    usage: usageState.tier === "free" ? usageState.usage : null,
  };
}
