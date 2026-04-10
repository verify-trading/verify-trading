import { SiteNav } from "@/components/site/site-nav";
import { OnboardingCallBanner } from "@/components/site/onboarding-call-banner";

/**
 * Shared shell for Ask / Markets / Tools so the navbar stays mounted on client
 * navigations (no flash when switching tabs).
 */
export default function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[var(--vt-navy)] text-white">
      <SiteNav />
      <OnboardingCallBanner />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
