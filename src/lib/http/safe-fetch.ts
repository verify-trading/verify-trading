import dns from "node:dns/promises";
import net from "node:net";

/**
 * SSRF guard for fetching user-supplied URLs server-side. Validates the scheme,
 * resolves the host, and rejects any address in a private / loopback / link-local
 * range (incl. cloud-metadata 169.254.169.254). Redirects are followed manually so
 * every hop is re-validated. DNS rebinding (re-resolve to a private IP between the
 * check and the fetch) is a residual risk not covered here.
 */
export class UnsafeUrlError extends Error {}

const PRIVATE_V4_RANGES: RegExp[] = [
  /^0\./, // "this" network
  /^10\./, // RFC1918
  /^127\./, // loopback
  /^169\.254\./, // link-local (incl. 169.254.169.254 metadata)
  /^172\.(1[6-9]|2\d|3[01])\./, // RFC1918
  /^192\.168\./, // RFC1918
  /^192\.0\.0\./, // IETF protocol assignments
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64/10
];

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    return PRIVATE_V4_RANGES.some((re) => re.test(ip));
  }
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // loopback / unspecified
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local
  const mapped = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPrivateIp(mapped[1]);
  return false;
}

async function assertPublicHost(hostname: string): Promise<void> {
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new UnsafeUrlError("URL points at a private address.");
    }
    return;
  }

  let resolved: Array<{ address: string }>;
  try {
    resolved = await dns.lookup(hostname, { all: true });
  } catch {
    throw new UnsafeUrlError("URL host could not be resolved.");
  }

  if (resolved.length === 0) {
    throw new UnsafeUrlError("URL host could not be resolved.");
  }
  for (const { address } of resolved) {
    if (isPrivateIp(address)) {
      throw new UnsafeUrlError("URL host resolves to a private address.");
    }
  }
}

interface FetchPublicUrlOptions {
  timeoutMs?: number;
  maxRedirects?: number;
}

/**
 * Fetch a user-supplied URL only if it is a public http(s) endpoint. Throws
 * UnsafeUrlError for blocked targets and times out by default.
 */
export async function fetchPublicUrl(
  rawUrl: string,
  { timeoutMs = 6000, maxRedirects = 3 }: FetchPublicUrlOptions = {},
): Promise<Response> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("Invalid URL.");
  }

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new UnsafeUrlError("Only http(s) URLs are allowed.");
    }

    await assertPublicHost(url.hostname);

    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "verify.trading-bot/1.0" },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        return response;
      }
      url = new URL(location, url);
      continue;
    }

    return response;
  }

  throw new UnsafeUrlError("Too many redirects.");
}
