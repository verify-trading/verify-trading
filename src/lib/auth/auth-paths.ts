/**
 * Login / signup / forgot-password routes. Middleware redirects signed-in users away;
 * nav hides redundant “Sign in” on these pages.
 */
export const AUTH_PAGE_PATHS = new Set(["/login", "/signup", "/forgot-password"]);
const AUTH_CHROME_HIDDEN_PATHS = new Set([...AUTH_PAGE_PATHS, "/auth/update-password"]);

export function isAuthPagePath(pathname: string | null | undefined): boolean {
  if (!pathname) {
    return false;
  }
  return AUTH_PAGE_PATHS.has(pathname);
}

export function hidesAuthChrome(pathname: string | null | undefined): boolean {
  if (!pathname) {
    return false;
  }
  return AUTH_CHROME_HIDDEN_PATHS.has(pathname);
}
