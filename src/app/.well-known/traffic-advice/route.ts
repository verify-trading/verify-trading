/**
 * Chrome's private prefetch proxy probes `/.well-known/traffic-advice` before it
 * will prefetch our pages, and logs a 404 here on every miss. This is a public
 * marketing site with nothing expensive behind a GET, so allow the full
 * fraction (1.0) rather than throttling or disallowing.
 *
 * The `application/trafficadvice+json` MIME type is required by the spec, which
 * is why this is a route handler and not a static file in `public/`.
 * https://github.com/buettner/private-prefetch-proxy/blob/main/traffic-advice.md
 */
export const dynamic = "force-static";

export function GET(): Response {
  return new Response('[{"user_agent": "prefetch-proxy", "fraction": 1.0}]', {
    headers: { "Content-Type": "application/trafficadvice+json" },
  });
}
