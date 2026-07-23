const UTM_STORAGE_KEY = "vt_utm_attribution";
const UTM_COOKIE_NAME = "vt_utm_attribution";
const UTM_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

export type UtmAttribution = Partial<Record<(typeof UTM_KEYS)[number], string>> & {
  landing_page?: string;
  captured_at?: string;
};

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function normalizeValue(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 200) : null;
}

function readStoredAttribution(): UtmAttribution | null {
  if (!isBrowser()) return null;

  try {
    const stored = window.localStorage.getItem(UTM_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as UtmAttribution;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeAttribution(attribution: UtmAttribution) {
  if (!isBrowser()) return;

  const serialized = JSON.stringify(attribution);
  window.localStorage.setItem(UTM_STORAGE_KEY, serialized);
  document.cookie = `${UTM_COOKIE_NAME}=${encodeURIComponent(serialized)}; Path=/; Max-Age=${UTM_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function captureUtmAttribution() {
  if (!isBrowser()) return null;

  const params = new URLSearchParams(window.location.search);
  const attribution: UtmAttribution = {};

  for (const key of UTM_KEYS) {
    const value = normalizeValue(params.get(key));
    if (value) {
      attribution[key] = value;
    }
  }

  if (Object.keys(attribution).length === 0) {
    return readStoredAttribution();
  }

  attribution.landing_page = `${window.location.pathname}${window.location.search}`;
  attribution.captured_at = new Date().toISOString();
  writeAttribution(attribution);
  return attribution;
}

export function getUtmEventParams(): Record<string, string> {
  const attribution = readStoredAttribution();
  if (!attribution) return {};

  const entries = Object.entries(attribution).filter((entry): entry is [string, string] => {
    const value = entry[1];
    return typeof value === "string" && value.length > 0;
  });

  return Object.fromEntries(entries);
}
