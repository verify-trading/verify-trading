import type { AccountMenuState } from "@/lib/auth/account-menu-query";
import type { MarketsAccessTier } from "@/lib/markets/markets-access-tier";

export type MarketsInitialTier = "pro" | "free" | undefined;

function accessTierFromInitial(initialTier: MarketsInitialTier): MarketsAccessTier {
  if (initialTier === "pro") return "pro";
  if (initialTier === "free") return "free";
  return "loading";
}

export type AccountMenuQuerySlice = {
  isError: boolean;
  isPending: boolean;
  data: AccountMenuState | undefined;
};

/**
 * Maps auth + hydrated account-menu query state to Markets UI tier.
 * Keeps tier logic testable and separate from React.
 */
export function deriveMarketsAccessTier(input: {
  authReady: boolean;
  isSignedIn: boolean;
  initialTier: MarketsInitialTier;
  accountMenu: AccountMenuQuerySlice;
}): MarketsAccessTier {
  const { authReady, isSignedIn, initialTier, accountMenu } = input;

  if (!authReady) {
    return accessTierFromInitial(initialTier);
  }
  if (!isSignedIn) {
    return "signed_out";
  }
  if (accountMenu.isError) {
    return "free";
  }
  if (accountMenu.isPending && accountMenu.data === undefined) {
    return accessTierFromInitial(initialTier);
  }
  return accountMenu.data?.profile?.tier === "pro" ? "pro" : "free";
}
