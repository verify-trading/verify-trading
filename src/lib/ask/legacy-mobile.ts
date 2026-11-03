/**
 * App builds up to 1.1.x render every broker score as "<n> / 10" with an n/10 bar, so "29/100"
 * showed as "29/100 / 10" with a full bar. Newer builds send x-vt-app-version and get "/100" as is.
 */
export const isLegacyMobile = (request: Request) =>
  /^Bearer\s/i.test(request.headers.get("authorization") ?? "") && !request.headers.has("x-vt-app-version");

/** Rewrites every broker card score "29/100" to "2.9" (what old builds draw correctly). */
export function withLegacyScores<T>(payload: T): T {
  return JSON.parse(JSON.stringify(payload), (_key, value) => {
    if (value?.type !== "broker" || typeof value.score !== "string") return value;
    const m = value.score.match(/^\s*(\d+)\s*\/\s*100\s*$/);
    return m ? { ...value, score: String(Number(m[1]) / 10) } : value;
  });
}
