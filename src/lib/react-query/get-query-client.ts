import { QueryClient, isServer } from "@tanstack/react-query";
import { cache } from "react";

/** Keep in sync with {@link Providers} expectations (shell queries rely on ~60s stale time). */
export const QUERY_CLIENT_DEFAULTS = {
  queries: {
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  },
} as const;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: QUERY_CLIENT_DEFAULTS,
  });
}

/** One QueryClient per RSC request on the server (TanStack + Next App Router pattern). */
const getServerQueryClient = cache(makeQueryClient);

let browserQueryClient: QueryClient | undefined;

/**
 * Server: cached per request. Browser: singleton so {@link HydrationBoundary} merges into the same cache as {@link QueryClientProvider}.
 */
export function getQueryClient() {
  if (isServer) {
    return getServerQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
