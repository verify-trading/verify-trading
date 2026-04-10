import { type NextRequest, NextResponse } from "next/server";

import { AUTH_PAGE_PATHS } from "@/lib/auth/auth-paths";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
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
      return NextResponse.redirect(login);
    }
    return response;
  }

  if (AUTH_PAGE_PATHS.has(pathname) && user) {
    return NextResponse.redirect(new URL("/ask", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
