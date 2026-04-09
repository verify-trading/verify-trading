import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Server-only: current user from cookies, or null if unconfigured / unauthenticated.
 * API routes use this for 401; pages use {@link requireSession} to redirect to login.
 */
export async function getSessionUser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return { user, supabase };
}

/** Server-only guard for protected App Router pages (defense in depth vs middleware). */
export async function requireSession(loginNextPath: string) {
  const session = await getSessionUser();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(loginNextPath)}`);
  }
  return session.user;
}
