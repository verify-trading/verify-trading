import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse;
  user: User | null;
}> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return { response: supabaseResponse, user: null };
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // No Supabase auth cookie => anonymous visitor, nothing to refresh. Skips the
  // auth round-trip that was timing out the middleware on public pages.
  if (!request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) {
    return { response: supabaseResponse, user: null };
  }

  // `getUser` (not `getSession`) so the user is authenticated against the Auth
  // server rather than trusted from the cookie.
  // ponytail: 3s cap so a slow Auth server degrades to "logged out" instead of a
  // 504 MIDDLEWARE_INVOCATION_TIMEOUT on every route.
  const user = await Promise.race([
    supabase.auth.getUser().then(({ data }) => data.user),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
  ]);

  return { response: supabaseResponse, user };
}
