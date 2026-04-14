import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { SiteNav } from "@/components/site/site-nav";
import { OnboardingCallBanner } from "@/components/site/onboarding-call-banner";
import { prefetchAccountMenuForSession } from "@/lib/auth/account-menu-query";
import { getSessionUser } from "@/lib/auth/session";
import { getQueryClient } from "@/lib/react-query/get-query-client";

/**
 * Shared shell for Ask / Markets / Tools so the navbar stays mounted on client
 * navigations (no flash when switching tabs).
 *
 * Prefetches the account-menu profile + Ask usage on the server so the client hydrates
 * TanStack Query once and avoids duplicate `profiles` round-trips on load.
 */
export default async function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const queryClient = getQueryClient();
  const session = await getSessionUser();
  if (session) {
    await prefetchAccountMenuForSession(queryClient, session.supabase, session.user.id);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="flex h-dvh flex-col overflow-hidden bg-[var(--vt-navy)] text-white">
        <SiteNav />
        <OnboardingCallBanner />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </HydrationBoundary>
  );
}
