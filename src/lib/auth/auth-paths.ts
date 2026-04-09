/**
 * Login / signup / forgot-password routes. Middleware redirects signed-in users away;
 * nav hides redundant “Sign in” on these pages.
 */
export const AUTH_PAGE_PATHS = new Set(["/login", "/signup", "/forgot-password"]);

export function isAuthPagePath(pathname: string | null | undefined): boolean {
  if (!pathname) {
    return false;
  }
  return AUTH_PAGE_PATHS.has(pathname);
}
