import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function createBearerSupabaseClient(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getBearerToken() {
  const authorization = (await headers()).get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

/**
 * Server-only: current user from web cookies or a native-app Bearer token.
 * API routes use this for 401; pages use {@link requireSession} to redirect to login.
 */
export async function getSessionUser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return null;
  }

  const bearerToken = await getBearerToken();
  if (bearerToken) {
    const bearerSupabase = createBearerSupabaseClient(bearerToken);
    if (bearerSupabase) {
      const {
        data: { user },
        error,
      } = await bearerSupabase.auth.getUser(bearerToken);

      if (!error && user) {
        return { user, supabase: bearerSupabase };
      }
    }
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
