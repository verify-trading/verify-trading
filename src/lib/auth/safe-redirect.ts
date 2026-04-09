/**
 * Returns a safe in-app path for post-login redirects.
 * Blocks open redirects: protocol-relative URLs (`//…`), schemes (`://`), and backslashes.
 */
export function getSafeRedirectPath(next: string | null | undefined, fallback = "/ask"): string {
  if (next == null || next === "") {
    return fallback;
  }
  const s = next.trim();
  if (!s.startsWith("/") || s.startsWith("//")) {
    return fallback;
  }
  if (s.includes("://") || s.includes("\\")) {
    return fallback;
  }
  return s;
}

/**
 * Propagates a validated `next` query parameter between auth pages without forcing one when absent.
 */
export function appendSafeNextParam(path: string, next: string | null | undefined): string {
  if (next == null || next.trim() === "") {
    return path;
  }

  const safeNext = getSafeRedirectPath(next, "");
  if (!safeNext) {
    return path;
  }

  const url = new URL(path, "https://verify.trading");
  url.searchParams.set("next", safeNext);
  return `${url.pathname}${url.search}`;
}
