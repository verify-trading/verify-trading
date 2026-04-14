"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { AppToaster } from "@/components/ui/app-toaster";
import { CookieConsentProvider } from "@/lib/cookie-consent/cookie-consent-context";
import { SupabaseAuthProvider } from "@/lib/supabase/auth-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseAuthProvider>
        <CookieConsentProvider>
          {children}
          <AppToaster />
        </CookieConsentProvider>
      </SupabaseAuthProvider>
    </QueryClientProvider>
  );
}
