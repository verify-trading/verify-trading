"use client";

import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import {
  createContext,
  startTransition,
  use,
  useEffect,
  useMemo,
  useReducer,
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

type AuthState = {
  user: User | null;
  session: Session | null;
  ready: boolean;
};

function authReducer(_state: AuthState, session: Session | null): AuthState {
  return {
    session,
    user: session?.user ?? null,
    ready: true,
  };
}

/**
 * Single browser client + auth listener (Next.js App Router + @supabase/ssr).
 * Prefer {@link useSupabaseAuth} over creating extra clients in components.
 */
export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    session: null,
    ready: false,
  });

  useEffect(() => {
    if (!supabase) {
      startTransition(() => dispatch(null));
      return;
    }

    let cancelled = false;

    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!cancelled) {
        startTransition(() => dispatch(s));
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!cancelled) {
        startTransition(() => dispatch(s));
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
      user: state.user,
      session: state.session,
      ready: state.ready,
      isSignedIn: Boolean(state.user),
    }),
    [supabase, state.ready, state.session, state.user],
  );

  return <SupabaseAuthContext.Provider value={value}>{children}</SupabaseAuthContext.Provider>;
}

export function useSupabaseAuth(): SupabaseAuthContextValue {
  const ctx = use(SupabaseAuthContext);
  if (!ctx) {
    throw new Error("useSupabaseAuth must be used within SupabaseAuthProvider");
  }
  return ctx;
}
