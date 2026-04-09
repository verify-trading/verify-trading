"use client";

import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type SupabaseAuthContextValue = {
  supabase: SupabaseClient | null;
  user: User | null;
  session: Session | null;
  ready: boolean;
  isSignedIn: boolean;
};

const SupabaseAuthContext = createContext<SupabaseAuthContextValue | null>(null);

/**
 * Single browser client + auth listener (Next.js App Router + @supabase/ssr).
 * Prefer {@link useSupabaseAuth} over creating extra clients in components.
 */
export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!supabase) {
      startTransition(() => setReady(true));
      return;
    }

    let cancelled = false;

    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!cancelled) {
        startTransition(() => {
          setSession(s);
          setUser(s?.user ?? null);
          setReady(true);
        });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!cancelled) {
        startTransition(() => {
          setSession(s);
          setUser(s?.user ?? null);
          setReady(true);
        });
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const value = useMemo<SupabaseAuthContextValue>(
    () => ({
      supabase,
      user,
      session,
      ready,
      isSignedIn: Boolean(user),
    }),
    [supabase, user, session, ready],
  );

  return <SupabaseAuthContext.Provider value={value}>{children}</SupabaseAuthContext.Provider>;
}

export function useSupabaseAuth(): SupabaseAuthContextValue {
  const ctx = useContext(SupabaseAuthContext);
  if (!ctx) {
    throw new Error("useSupabaseAuth must be used within SupabaseAuthProvider");
  }
  return ctx;
}
