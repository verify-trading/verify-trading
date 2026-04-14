"use client";

import { useQuery } from "@tanstack/react-query";

import { getAccountMenuQueryOptions } from "@/lib/auth/account-menu-query";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";

/** Shell profile + Ask usage; same options as server prefetch in `(app)/layout`. */
export function useAccountMenuQuery() {
  const { supabase, user } = useSupabaseAuth();
  return useQuery(getAccountMenuQueryOptions(supabase, user?.id));
}
