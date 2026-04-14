"use client";

import { QueryClientProvider } from "@tanstack/react-query";

import { AppToaster } from "@/components/ui/app-toaster";
import { CookieConsentProvider } from "@/lib/cookie-consent/cookie-consent-context";
import { getQueryClient } from "@/lib/react-query/get-query-client";
import { SupabaseAuthProvider } from "@/lib/supabase/auth-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

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
