import { type NextRequest, NextResponse } from "next/server";

import { AUTH_PAGE_PATHS } from "@/lib/auth/auth-paths";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * `updateSession` may set refreshed Supabase cookies on `sessionResponse`.
 * A plain `NextResponse.redirect()` drops those `Set-Cookie` headers, so the
 * browser can miss a token rotation and the next request looks logged out.
 */
function redirectPreservingSessionCookies(
  sessionResponse: NextResponse,
  destination: string | URL,
): NextResponse {
  const redirect = NextResponse.redirect(destination);
  if (typeof sessionResponse.headers.getSetCookie === "function") {
    for (const cookie of sessionResponse.headers.getSetCookie()) {
      redirect.headers.append("Set-Cookie", cookie);
    }
    return redirect;
  }

  sessionResponse.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  return redirect;
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  /**
   * When `redirectTo` is not allowlisted in Supabase, Auth falls back to **Site URL**
   * and appends `?code=…` there — often `/` instead of `/auth/callback`. The PKCE
   * exchange only runs in `app/auth/callback/route.ts`, so we forward the same query.
   */
  if (url.pathname === "/" && url.searchParams.has("code")) {
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  const { response, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  const requiresAuth =
    pathname.startsWith("/ask") ||
    pathname.startsWith("/guide") ||
    pathname.startsWith("/markets") ||
    pathname.startsWith("/auth/update-password");

  if (requiresAuth) {
    if (!user) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return redirectPreservingSessionCookies(response, login);
    }
    return response;
  }

  if (AUTH_PAGE_PATHS.has(pathname) && user) {
    return redirectPreservingSessionCookies(response, new URL("/ask", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
