import { fetchWithRetry, parseRetryAfterMs, wait } from "@/lib/http/fetch-with-retry";
import { logger } from "@/lib/observability/logger";

/**
 * Thin typed wrapper over the MetaApi REST API (no SDK — we use six endpoints). Two things here
 * are load-bearing and easy to get wrong:
 *
 * 1. The domain suffix differs per service. Provisioning is the DOUBLED
 *    `agiliumtrade.agiliumtrade.ai`; MetaStats is the single `agiliumtrade.ai` WITH a region
 *    segment. Getting it backwards yields a DNS failure or a Kubernetes-ingress fake-certificate
 *    TLS error, neither of which reads as "wrong URL" — so both bases are written out in full.
 * 2. MetaApi answers a write with `202` to mean "accepted, still working", and the poll is
 *    re-sending the IDENTICAL request with the SAME transaction-id. A fresh id would register as
 *    a second billable write, so the id is minted once per call.
 */

const PROVISIONING_BASE = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";

/** MetaStats is region-routed: the wrong region 404s exactly like a missing account. */
function metastatsBase(region: string) {
  return `https://metastats-api-v1.${region}.agiliumtrade.ai`;
}

/** Fallback when MetaApi hasn't reported a region yet — see GET /users/current/regions. */
export const DEFAULT_METAAPI_REGION = "london";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ACCEPTED_ATTEMPTS = 5;
const ACCEPTED_BACKOFF_MS = 1_000;

export type BrokerPlatform = "mt4" | "mt5";

export class MetaApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

/**
 * MetaApi account snapshot. Note `_id` here vs `id` on the create response, and that there is no
 * `platform` field on the way back: MetaApi answers with `version: 4 | 5` even though
 * `platform: "mt4" | "mt5"` is what it accepts on create.
 */
export type MetaApiAccount = {
  _id: string;
  state: string;
  connectionStatus: string;
  region?: string;
  baseCurrency?: string;
  /** MetaTrader version: 4 or 5. The read-side counterpart of `platform` on create. */
  version?: number;
  server?: string;
  login?: string;
};

/** `version` as the platform string the rest of the app speaks; undefined if unreported. */
export function platformOfVersion(version: number | undefined): BrokerPlatform | undefined {
  return version === 4 ? "mt4" : version === 5 ? "mt5" : undefined;
}

/** MetaStats historical trade. Only the fields the importer reads are typed. */
export type MetaStatsTrade = {
  _id: string;
  accountId: string;
  type: string;
  profit: number;
  closeTime?: string;
  [key: string]: unknown;
};

function authToken() {
  const token = process.env.METAAPI_TOKEN;
  if (!token) {
    throw new MetaApiError(500, "METAAPI_TOKEN is not set.");
  }
  return token;
}

/** 32 chars, no dashes — MetaApi's documented transaction-id shape. */
function transactionId() {
  return crypto.randomUUID().replaceAll("-", "");
}

/**
 * MetaApi's own message is the only useful part of a failure, and it is what ends up in
 * `stateDetail` / `last_sync_error` in front of the trader — so keep it rather than inventing our
 * own wording.
 */
async function readErrorMessage(response: Response) {
  const body = await response.text().catch(() => "");
  try {
    const parsed = JSON.parse(body) as { message?: unknown; error?: unknown };
    if (typeof parsed.message === "string" && parsed.message) return parsed.message;
    if (typeof parsed.error === "string" && parsed.error) return parsed.error;
  } catch {
    // non-JSON body (gateway HTML) — fall through
  }
  return body.slice(0, 300) || `MetaApi request failed with ${response.status}.`;
}

type MetaApiRequestInit = {
  method?: string;
  body?: unknown;
  /** POSTs carry a transaction-id; the same one is reused across 202 polls. */
  transactional?: boolean;
};

async function metaApiFetch(url: string, init: MetaApiRequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = { "auth-token": authToken() };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.transactional) headers["transaction-id"] = transactionId();

  for (let attempt = 1; ; attempt += 1) {
    const response = await fetchWithRetry(
      url,
      {
        method: init.method ?? "GET",
        headers,
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
        cache: "no-store",
      },
      { attempts: 2, timeoutMs: REQUEST_TIMEOUT_MS },
    );

    // 202 = "still working, ask again". Provisioning wants the identical request back; MetaStats
    // sends a retry-after. Bounded — a stuck job must surface, not spin.
    if (response.status === 202 && attempt < MAX_ACCEPTED_ATTEMPTS) {
      await wait(parseRetryAfterMs(response.headers.get("retry-after")) ?? ACCEPTED_BACKOFF_MS * attempt);
      continue;
    }

    // Out of attempts and STILL 202. This has to throw: 202 satisfies response.ok, so the guard
    // below waves it through and the caller reads a half-finished body as the result — for POST
    // /accounts that means an id that may not be there, and a compensating delete aimed at
    // `undefined` while the real account bills on. The caller never learns an id, so its
    // compensating delete cannot run: log the transaction-id, the only handle left for finding a
    // paid orphan in the dashboard.
    if (response.status === 202) {
      logger.error("MetaApi write never settled; a paid resource may be orphaned.", {
        url,
        transactionId: headers["transaction-id"] ?? null,
      });
      throw new MetaApiError(202, "MetaApi is still working on this. Try again in a moment.");
    }

    if (!response.ok) {
      throw new MetaApiError(response.status, await readErrorMessage(response));
    }
    return response;
  }
}

async function metaApiJson<T>(url: string, init?: MetaApiRequestInit): Promise<T> {
  const response = await metaApiFetch(url, init);
  return (await response.json()) as T;
}

/**
 * Creates the account WITHOUT credentials — the trader supplies those on MetaApi's hosted page
 * (see {@link createConfigurationLink}). `server` and `platform` must be known up front because
 * that page collects login + password only.
 */
export async function createAccount(input: {
  userId: string;
  platform: BrokerPlatform;
  server: string;
}): Promise<{ id: string; state?: string }> {
  return metaApiJson<{ id: string; state?: string }>(`${PROVISIONING_BASE}/users/current/accounts`, {
    method: "POST",
    transactional: true,
    body: {
      name: `verify.trading — ${input.userId}`,
      server: input.server,
      platform: input.platform,
      // magic must be 0 alongside manualTrades; we only ever read closed trades.
      magic: 0,
      // cloud-g2 + high reliability: g2 is ~3x cheaper per hour and MetaApi does not
      // sell "regular" reliability on g2 anyway, so asking for it only forces g1.
      type: "cloud-g2",
      reliability: "high",
      manualTrades: true,
      // Defaults to false, and historical-trades 403s without it. Enabling it later
      // stops the account and is billed, so it has to be set at creation.
      metastatsApiEnabled: true,
      riskManagementApiEnabled: false,
      tags: ["verify-trading"],
      metadata: { verifyUserId: input.userId },
    },
  });
}

export async function getAccount(accountId: string): Promise<MetaApiAccount> {
  return metaApiJson<MetaApiAccount>(`${PROVISIONING_BASE}/users/current/accounts/${accountId}`);
}

// getConfigurationInformation is deliberately absent. GET .../configuration-information
// authenticates with the short-lived CONFIGURATION token minted next to the hosted page, not the
// account-management token this service holds, so it always fails with "Configuration token does
// not match the account id". Whether an account has credentials is read off its own state instead
// — see UNCONFIGURED_STATE in sync.ts.

/**
 * Hosted page where the trader enters login + investor password. Re-issuable — that is also how a
 * password change is handled — and MetaApi never discloses what was typed, including to us.
 */
export async function createConfigurationLink(accountId: string, ttlInDays = 7): Promise<string> {
  const { configurationLink } = await metaApiJson<{ configurationLink?: string }>(
    `${PROVISIONING_BASE}/users/current/accounts/${accountId}/configuration-link?ttlInDays=${ttlInDays}`,
    { method: "PUT" },
  );
  if (!configurationLink) {
    throw new MetaApiError(502, "MetaApi returned no configuration link.");
  }
  return configurationLink;
}

/** Idempotent at MetaApi — ignored when already deployed. Billed per deployment. */
export async function deployAccount(accountId: string): Promise<void> {
  await metaApiFetch(`${PROVISIONING_BASE}/users/current/accounts/${accountId}/deploy`, {
    method: "POST",
    transactional: true,
  });
}

/** Idempotent at MetaApi — ignored when already undeployed. */
export async function undeployAccount(accountId: string): Promise<void> {
  await metaApiFetch(`${PROVISIONING_BASE}/users/current/accounts/${accountId}/undeploy`, {
    method: "POST",
    transactional: true,
  });
}

/**
 * Delete tears the account down on its own — undeploying first is not required (and would be a
 * wasted call). A 404 means it is already gone, which is the state we wanted.
 */
export async function deleteAccount(accountId: string): Promise<void> {
  try {
    await metaApiFetch(`${PROVISIONING_BASE}/users/current/accounts/${accountId}`, {
      method: "DELETE",
    });
  } catch (error) {
    if (error instanceof MetaApiError && error.status === 404) return;
    throw error;
  }
}

/**
 * Broker-server search for the connect screen. The path segment is the MT version NUMBER (4/5),
 * not the platform string, and there is no /users/current prefix. Response is broker name ->
 * server names; the picker only needs the server strings.
 */
export async function searchServers(platform: BrokerPlatform, query: string): Promise<string[]> {
  const version = platform === "mt4" ? 4 : 5;
  const byBroker = await metaApiJson<Record<string, string[]>>(
    `${PROVISIONING_BASE}/known-mt-servers/${version}/search?query=${encodeURIComponent(query)}`,
  );
  const servers = Object.values(byBroker ?? {}).flat();
  return [...new Set(servers.filter((server) => typeof server === "string" && server))];
}

/**
 * MetaStats wants `YYYY-MM-DD HH:mm:ss.SSS` in BROKER time, not ISO — no `T`, no `Z`. The literal
 * space has to survive as %20 in the path, which is why the caller must encodeURIComponent each
 * segment (encodeURI leaves the space and the request never even leaves the process).
 */
export function formatMetaStatsTime(date: Date): string {
  return date.toISOString().slice(0, 23).replace("T", " ");
}

const TRADES_PAGE_SIZE = 1000;
/** Pages allowed for ONE window. Hitting this is not a failure — it is the signal to halve. */
const MAX_TRADE_PAGES = 100;
/**
 * Total pages the whole walk may spend, splits included. This is the real stop: bisection alone
 * would keep subdividing a pathological account until the request timed out, and a serverless
 * function has one budget for every account in the pass.
 */
const MAX_TOTAL_PAGES = 400;
/** Below this span there is nothing left to halve — one day that dense is an anomaly. */
const MIN_SPLIT_MS = 24 * 60 * 60 * 1000;

/**
 * Closed trades in [startTime, endTime). `updateHistory=true` refreshes from the running terminal
 * first, which is why the account has to be deployed.
 *
 * A window denser than MAX_TRADE_PAGES is HALVED and each half read separately. Truncating would
 * silently lose trades; throwing did not self-heal (the error makes computeSyncWindow re-request
 * the same oversized window forever). Bisection makes a heavy account slow rather than stuck. A
 * normal account never splits — one short page, one request.
 */
export async function fetchHistoricalTrades(input: {
  accountId: string;
  region: string;
  start: Date;
  end: Date;
  updateHistory?: boolean;
}): Promise<MetaStatsTrade[]> {
  const base = metastatsBase(input.region);
  // The terminal refresh happens once for the whole walk, on the very first request made —
  // splitting must not buy it again per sub-window.
  let refreshPending = input.updateHistory ?? true;
  let pagesSpent = 0;

  /** Reads one window, or returns null when it is too dense to finish inside the page cap. */
  async function readWindow(start: Date, end: Date): Promise<MetaStatsTrade[] | null> {
    const startSegment = encodeURIComponent(formatMetaStatsTime(start));
    const endSegment = encodeURIComponent(formatMetaStatsTime(end));
    const trades: MetaStatsTrade[] = [];
    for (let page = 0; page < MAX_TRADE_PAGES; page += 1) {
      if (pagesSpent >= MAX_TOTAL_PAGES) {
        throw new MetaApiError(
          502,
          `More than ${MAX_TOTAL_PAGES * TRADES_PAGE_SIZE} trades in this sync window — history was not read in full.`,
        );
      }
      const refresh = refreshPending;
      refreshPending = false;
      pagesSpent += 1;
      const url =
        `${base}/users/current/accounts/${input.accountId}/historical-trades/${startSegment}/${endSegment}` +
        `?limit=${TRADES_PAGE_SIZE}&offset=${page * TRADES_PAGE_SIZE}&updateHistory=${refresh}`;
      const payload = await metaApiJson<{ trades?: MetaStatsTrade[] }>(url);
      const pageTrades = payload?.trades ?? [];
      trades.push(...pageTrades);
      // A short page is the end of the window — the only clean way out of this loop.
      if (pageTrades.length < TRADES_PAGE_SIZE) return trades;
    }
    return null;
  }

  // A dense window's partial read is DISCARDED, not merged: it is a partial view of a range the
  // halves then read properly, and keeping it would mix two readings of the same range.
  async function walk(start: Date, end: Date): Promise<MetaStatsTrade[]> {
    const read = await readWindow(start, end);
    if (read) return read;
    const span = end.getTime() - start.getTime();
    if (span <= MIN_SPLIT_MS) {
      throw new MetaApiError(
        502,
        `More than ${MAX_TRADE_PAGES * TRADES_PAGE_SIZE} trades closed in a single day — history was not read in full.`,
      );
    }
    const mid = new Date(start.getTime() + Math.floor(span / 2));
    return [...(await walk(start, mid)), ...(await walk(mid, end))];
  }

  return walk(input.start, input.end);
}
