import { fetchWithRetry, parseRetryAfterMs, wait } from "@/lib/http/fetch-with-retry";
import { logger } from "@/lib/observability/logger";

/**
 * Thin typed wrapper over the MetaApi REST API (no SDK — we use seven endpoints). Two things here
 * are load-bearing and easy to get wrong:
 *
 * 1. The domain suffix differs per service. Provisioning is the DOUBLED
 *    `agiliumtrade.agiliumtrade.ai`; MetaStats is the single `agiliumtrade.ai` WITH a region
 *    segment. Getting it backwards yields a DNS failure or a Kubernetes-ingress fake-certificate
 *    TLS error, neither of which reads as "wrong URL" — so both bases are written out in full.
 * 2. MetaApi answers a write with `202` to mean "accepted, still working", and the poll is
 *    re-sending the IDENTICAL request with the SAME transaction-id. A fresh id would register as
 *    a second billable write, so the id is minted once per call.
 *
 * Credentials flow through createAccount / updateAccountPassword and are never stored or logged
 * here — and MetaApi's error messages never echo them back, so the logging in this file is safe.
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
/**
 * The most a single 202 poll may sleep, however generous the Retry-After. The credential-
 * validating create runs inside a route whose maxDuration is 300 s (see CREATE_ACCEPTED_ATTEMPTS
 * below), so an uncapped 60 s+ header times the poll count could outlive the function and surface
 * as a killed invocation with the account half-created. Capped, the worst case stays inside the
 * outer bound with room for the network time around it.
 */
const MAX_ACCEPTED_WAIT_MS = 60_000;

export type BrokerPlatform = "mt4" | "mt5";

export class MetaApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** MetaApi's machine code from `details` (E_AUTH, E_SRV_NOT_FOUND, …) when it sent one. */
    readonly code?: string,
    /** E_SRV_NOT_FOUND lists the server names the trader probably meant. */
    readonly suggestedServers?: string[],
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
 * own wording. The machine code rides along for the connect route, which rewrites credential
 * rejections (E_AUTH) into shorter trader-facing copy keyed off it.
 */
type MetaApiErrorBody = {
  message?: unknown;
  error?: unknown;
  details?: unknown;
};

type MetaApiErrorDetailsResult = {
  code?: string;
  suggestedServers?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function readErrorDetails(details: unknown): MetaApiErrorDetailsResult {
  if (typeof details === "string") return { code: details };
  if (!isRecord(details)) return {};

  const serversByBrokers = details.serversByBrokers;
  const suggestedServers = isRecord(serversByBrokers)
    ? [...new Set(Object.values(serversByBrokers).flatMap((servers) =>
        Array.isArray(servers) ? servers.filter((server): server is string => Boolean(stringValue(server))) : []))]
    : undefined;
  return { code: stringValue(details.code), suggestedServers };
}

async function readError(response: Response): Promise<{ message: string; code?: string; suggestedServers?: string[] }> {
  const body = await response.text().catch(() => "");
  try {
    const parsed = JSON.parse(body) as MetaApiErrorBody;
    const message = stringValue(parsed.message) ?? stringValue(parsed.error);
    // `details` is a plain string ("E_AUTH") on some errors and an object carrying `code` on
    // others (E_SRV_NOT_FOUND). Both shapes are documented on the create-account page.
    if (message) return { message, ...readErrorDetails(parsed.details) };
  } catch {
    // non-JSON body (gateway HTML) — fall through
  }
  return { message: body.slice(0, 300) || `MetaApi request failed with ${response.status}.` };
}

type MetaApiRequestInit = {
  method?: string;
  body?: unknown;
  /** POSTs carry a transaction-id; the same one is reused across 202 polls. */
  transactional?: boolean;
  /**
   * A transaction-id minted by the caller instead of here. Only the create needs it: it logs
   * the id BEFORE the call, and that trail is worthless unless it is the id actually sent.
   */
  transactionId?: string;
  /**
   * How many 202 "still working" polls to allow. The credential-validating create is slower to
   * settle than a deploy — broker settings detection can answer "retry in 60 seconds" — so it
   * passes a larger budget. Retry-After is honoured either way.
   */
  acceptedAttempts?: number;
};

async function metaApiFetch(url: string, init: MetaApiRequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = { "auth-token": authToken() };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.transactional) headers["transaction-id"] = init.transactionId ?? transactionId();
  const maxAccepted = init.acceptedAttempts ?? MAX_ACCEPTED_ATTEMPTS;

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
    // sends a retry-after. Bounded — a stuck job must surface, not spin. The wait is capped so
    // the whole poll fits inside the calling function's lifetime, Retry-After or not.
    if (response.status === 202 && attempt < maxAccepted) {
      const waitMs = parseRetryAfterMs(response.headers.get("retry-after")) ?? ACCEPTED_BACKOFF_MS * attempt;
      await wait(Math.min(waitMs, MAX_ACCEPTED_WAIT_MS));
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
      const error = await readError(response);
      throw new MetaApiError(response.status, error.message, error.code, error.suggestedServers);
    }
    return response;
  }
}

async function metaApiJson<T>(url: string, init?: MetaApiRequestInit): Promise<T> {
  const response = await metaApiFetch(url, init);
  return (await response.json()) as T;
}

/**
 * Creates the account WITH the trader's credentials, typed in our app and forwarded here —
 * never stored, never logged. MetaApi validates them synchronously during "automatic broker
 * settings detection", so a bad login fails this call with a 400 (E_AUTH) instead of surfacing
 * as a broken deploy minutes later. That validation is also why the 202 budget is larger than
 * any other call's: detection answers "retry in 60 seconds" while it works, and a wrong
 * password is only known at the end of it.
 *
 * The credentials live at MetaApi from here on; this service holds neither them nor a way to
 * read them back.
 */
export async function createAccount(input: {
  userId: string;
  platform: BrokerPlatform;
  server: string;
  login: string;
  password: string;
}): Promise<{ id: string; state?: string }> {
  // Minted and logged BEFORE the network call, because this is the $2.10 one. The route's
  // compensating delete only runs if this function returns or throws — a slow create that
  // outlives the invocation is killed, and then the id below is the only handle anyone has for
  // finding the paid orphan in MetaApi's dashboard. The 202-exhausted log inside metaApiFetch
  // covers a poll that runs out; it cannot cover being killed mid-poll.
  const transaction = transactionId();
  logger.info("MetaApi account create starting.", { transactionId: transaction, userId: input.userId });

  return metaApiJson<{ id: string; state?: string }>(`${PROVISIONING_BASE}/users/current/accounts`, {
    method: "POST",
    transactional: true,
    transactionId: transaction,
    // Settings detection + auth validation can take a couple of minutes of 202 polling.
    acceptedAttempts: CREATE_ACCEPTED_ATTEMPTS,
    body: {
      name: accountName(input.userId),
      login: input.login,
      password: input.password,
      server: input.server,
      platform: input.platform,
      ...ACCOUNT_SETTINGS,
      metadata: { verifyUserId: input.userId },
    },
  });
}

/**
 * The settings that define what an account IS at MetaApi, shared by the two writes that send
 * them. They live here rather than inline because the create and the password PUT drifting
 * apart is a silent, expensive bug — see updateAccountPassword.
 */
const ACCOUNT_SETTINGS = {
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
} as const;

/** One name everywhere an account needs one — create requires it, and so does the update. */
function accountName(userId: string) {
  return `verify.trading — ${userId}`;
}

// Broker settings detection answers 202 with up to a 60 s Retry-After while it validates the
// credentials, and the route's maxDuration (300 s) is the outer bound this budget has to fit in.
// A poll is NOT one 15 s request: fetchWithRetry sends each one twice before giving up and may
// sleep a capped MAX_RETRY_DELAY_MS (15 s) between them on a retryable status, so one poll costs
// up to ~45 s. At 4 polls the worst case (3 × 60 s capped waits + 4 × 45 s) is past 300 s on its
// own, before the route's session read, dormant read and Supabase writes — and a function killed
// mid-poll never runs the compensating delete, leaving a paid orphan. Three polls (2 × 60 s +
// 3 × 45 s ≈ 255 s) is what fits, and only because the retry sleep is capped: an honoured 120 s
// Retry-After on a single 503 used to blow the whole budget by itself.
const CREATE_ACCEPTED_ATTEMPTS = 3;

export async function getAccount(accountId: string): Promise<MetaApiAccount> {
  return metaApiJson<MetaApiAccount>(`${PROVISIONING_BASE}/users/current/accounts/${accountId}`);
}

/**
 * Replaces the investor password on an existing account — the recovery path when the broker
 * starts turning the login away (password changed at the broker, typo at connect). MetaApi
 * re-validates synchronously, so a bad new password fails here with E_AUTH, not at the next
 * deploy. `password`, `name` and `server` are all required by the PUT; login cannot change
 * (a different login IS a different trading account — that is the create path).
 *
 * Answers 204 No Content, so this reads the response for its status only. The new password
 * takes effect on the next deploy — MetaApi documents "redeploy for settings to take effect",
 * and our accounts are parked between syncs, so the caller just parks it.
 *
 * It sends every setting the create chose, not just the changed password. MetaApi does not
 * document whether this PUT merges into the account or replaces it, and the two readings differ
 * expensively: under replace semantics a partial body drops the g2 tier the whole cost model is
 * quoted against, the metadata tying the account back to a user, and metastatsApiEnabled — which
 * cannot be turned back on without stopping and re-billing the account. Re-sending values
 * identical to what is already stored is a no-op under merge semantics, so the full body is the
 * only one that is safe under both.
 */
export async function updateAccountPassword(input: {
  accountId: string;
  userId: string;
  server: string;
  password: string;
}): Promise<void> {
  await metaApiFetch(`${PROVISIONING_BASE}/users/current/accounts/${input.accountId}`, {
    method: "PUT",
    transactional: true,
    acceptedAttempts: CREATE_ACCEPTED_ATTEMPTS,
    body: {
      name: accountName(input.userId),
      password: input.password,
      server: input.server,
      // platform and login are deliberately absent: MetaApi fixes both at creation and a
      // different login IS a different account, which is the create path.
      ...ACCOUNT_SETTINGS,
      metadata: { verifyUserId: input.userId },
    },
  });
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
