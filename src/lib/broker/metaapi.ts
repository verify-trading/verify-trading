import { fetchWithRetry, MAX_RETRY_DELAY_MS, parseRetryAfterMs, wait } from "@/lib/http/fetch-with-retry";
import { logger } from "@/lib/observability/logger";

// Provisioning uses the DOUBLED domain `agiliumtrade.agiliumtrade.ai`; MetaStats uses the single
// `agiliumtrade.ai` with a region segment. Swapped, they fail as DNS or fake-certificate TLS errors.
// 202 means "accepted, still working": the poll re-sends the IDENTICAL request with the SAME
// transaction-id, because a fresh id registers as a second billable write.
// Credentials pass through createAccount / updateAccountPassword and are never stored or logged.

const PROVISIONING_BASE = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";

/** MetaStats is region-routed: the wrong region 404s exactly like a missing account. */
function metastatsBase(region: string) {
  return `https://metastats-api-v1.${region}.agiliumtrade.ai`;
}

/** Fallback when MetaApi hasn't reported a region yet — see GET /users/current/regions. */
export const DEFAULT_METAAPI_REGION = "london";

const REQUEST_TIMEOUT_MS = 15_000;
/** How many times fetchWithRetry sends each request before giving up. Feeds POLL_COST_MS. */
const FETCH_ATTEMPTS = 2;
const MAX_ACCEPTED_ATTEMPTS = 5;
const ACCEPTED_BACKOFF_MS = 1_000;
// Ceiling on one 202 sleep, however generous the Retry-After: the create runs in a route with
// maxDuration 300 s, and an uncapped wait outlives it, leaving the account half-created.
const MAX_ACCEPTED_WAIT_MS = 60_000;

/** What MetaApi gives an account unasked, and all any account gets until MetaApi refuses it. */
export const DEFAULT_RESOURCE_SLOTS = 1;

export type BrokerPlatform = "mt4" | "mt5";

export class MetaApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** MetaApi's machine code from `details` (E_AUTH, E_SRV_NOT_FOUND, …) when it sent one. */
    readonly code?: string,
    /** E_SRV_NOT_FOUND lists the server names the trader probably meant. */
    readonly suggestedServers?: string[],
    /** E_RESOURCE_SLOTS carries the slot count MetaApi wants the same request re-sent with. */
    readonly recommendedResourceSlots?: number,
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

// `_id` here vs `id` on the create response, and there is no `platform` on the way back: MetaApi
// reads back `version: 4 | 5` even though it accepts `platform: "mt4" | "mt5"` on create.
export type MetaApiAccount = {
  _id: string;
  state: string;
  connectionStatus: string;
  region?: string;
  baseCurrency?: string;
  version?: number;
  server?: string;
  login?: string;
  /** How many slots this account actually runs on. The password PUT has to send it back. */
  resourceSlots?: number;
};

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

// MetaApi's own message reaches the trader via `stateDetail` / `last_sync_error`; the machine code
// rides along so the connect route can rewrite E_AUTH into shorter copy.
type MetaApiErrorBody = {
  message?: unknown;
  error?: unknown;
  details?: unknown;
};

type MetaApiErrorDetailsResult = {
  code?: string;
  suggestedServers?: string[];
  recommendedResourceSlots?: number;
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
  // E_RESOURCE_SLOTS is the one error that says how to fix itself, so the number rides along.
  const recommended = details.recommendedResourceSlots;
  return {
    code: stringValue(details.code),
    suggestedServers,
    recommendedResourceSlots: typeof recommended === "number" ? recommended : undefined,
  };
}

async function readError(
  response: Response,
): Promise<{ message: string; code?: string; suggestedServers?: string[]; recommendedResourceSlots?: number }> {
  const body = await response.text().catch(() => "");
  try {
    const parsed = JSON.parse(body) as MetaApiErrorBody;
    const message = stringValue(parsed.message) ?? stringValue(parsed.error);
    // `details` is a plain string ("E_AUTH") on some errors, an object with `code` on others.
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
  /** Caller-minted id. Only the create needs it: it logs the id BEFORE the call. */
  transactionId?: string;
  /** How many 202 "still working" polls to allow. Retry-After is honoured either way. */
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
      { attempts: FETCH_ATTEMPTS, timeoutMs: REQUEST_TIMEOUT_MS },
    );

    // 202 = "still working, ask again". Bounded, and each wait capped, so the whole poll fits
    // inside the calling function's lifetime whatever Retry-After says.
    if (response.status === 202 && attempt < maxAccepted) {
      const waitMs = parseRetryAfterMs(response.headers.get("retry-after")) ?? ACCEPTED_BACKOFF_MS * attempt;
      await wait(Math.min(waitMs, MAX_ACCEPTED_WAIT_MS));
      continue;
    }

    // Out of attempts and still 202. Must throw: 202 satisfies response.ok, so the caller would
    // read a half-finished body and aim its compensating delete at `undefined` while the real
    // account bills on. The transaction-id is the only handle left for finding a paid orphan.
    if (response.status === 202) {
      logger.error("MetaApi write never settled; a paid resource may be orphaned.", {
        url,
        transactionId: headers["transaction-id"] ?? null,
      });
      throw new MetaApiError(202, "MetaApi is still working on this. Try again in a moment.");
    }

    if (!response.ok) {
      const error = await readError(response);
      throw new MetaApiError(
        response.status,
        error.message,
        error.code,
        error.suggestedServers,
        error.recommendedResourceSlots,
      );
    }
    return response;
  }
}

async function metaApiJson<T>(url: string, init?: MetaApiRequestInit): Promise<T> {
  const response = await metaApiFetch(url, init);
  return (await response.json()) as T;
}

// Creates the account WITH the trader's credentials — never stored, never logged here. MetaApi
// validates them synchronously during broker settings detection, so a bad login fails this call
// with a 400 (E_AUTH); that detection is why the 202 budget is larger than any other call's.
export async function createAccount(input: {
  userId: string;
  platform: BrokerPlatform;
  server: string;
  login: string;
  password: string;
  /** DEFAULT_RESOURCE_SLOTS unless a previous attempt came back E_RESOURCE_SLOTS. */
  resourceSlots: number;
  /** 202-poll ceiling, from createPollBudget. Required, not defaulted: a create that polls on the
   *  full budget regardless of how much of the invocation is left is the orphan case. */
  acceptedAttempts: number;
}): Promise<{ id: string; state?: string }> {
  // Minted and logged BEFORE the network call, because this is the $2.10 one: a create killed
  // mid-flight never runs the route's compensating delete, and this id is then the only handle
  // for finding the paid orphan in MetaApi's dashboard.
  const transaction = transactionId();
  logger.info("MetaApi account create starting.", { transactionId: transaction, userId: input.userId });

  return metaApiJson<{ id: string; state?: string }>(`${PROVISIONING_BASE}/users/current/accounts`, {
    method: "POST",
    transactional: true,
    transactionId: transaction,
    // Settings detection + auth validation can take a couple of minutes of 202 polling.
    acceptedAttempts: input.acceptedAttempts,
    body: {
      name: accountName(input.userId),
      login: input.login,
      password: input.password,
      server: input.server,
      platform: input.platform,
      ...ACCOUNT_SETTINGS,
      resourceSlots: input.resourceSlots,
      metadata: { verifyUserId: input.userId },
    },
  });
}

// Shared by the create and the password PUT; the two drifting apart is a silent, expensive bug.
// `resourceSlots` is deliberately NOT in here: it is the one setting that varies per account, so
// both calls pass it beside this spread rather than reading it from a shared const.
const ACCOUNT_SETTINGS = {
  // magic must be 0 alongside manualTrades; we only ever read closed trades.
  magic: 0,
  // g2 is ~3x cheaper per hour, and MetaApi doesn't sell "regular" reliability on g2 anyway.
  type: "cloud-g2",
  reliability: "high",
  manualTrades: true,
  // historical-trades 403s without it, and enabling it later stops and re-bills the account.
  metastatsApiEnabled: true,
  riskManagementApiEnabled: false,
  tags: ["verify-trading"],
} as const;

function accountName(userId: string) {
  return `verify.trading — ${userId}`;
}

// Sized against the route's 300 s maxDuration. One poll costs up to POLL_COST_MS plus a
// Retry-After of up to 60 s, so 3 polls ≈ 255 s fits and 4 does not. Overrunning kills the
// function mid-poll, which skips the compensating delete and leaves a paid orphan.
const CREATE_ACCEPTED_ATTEMPTS = 3;

/**
 * Worst case for ONE MetaApi call: fetchWithRetry sends it FETCH_ATTEMPTS times, each capped at
 * REQUEST_TIMEOUT_MS, sleeping up to MAX_RETRY_DELAY_MS between. Every input is imported rather
 * than copied, so moving any of them moves this — and it is also the amount a caller reserves
 * when it has to keep enough time for a compensating call of its own.
 */
export const POLL_COST_MS =
  FETCH_ATTEMPTS * REQUEST_TIMEOUT_MS + (FETCH_ATTEMPTS - 1) * MAX_RETRY_DELAY_MS;

/**
 * How many of the create's 202 polls still fit in `remainingMs`, capped at the normal budget.
 * Zero means: do not start a create at all — one killed mid-poll skips its caller's compensating
 * delete and leaves a paid account billing with nothing pointing at it.
 *
 * DERIVED, not a written-down 255 s: N polls cost N * POLL_COST_MS with a wait between each, so
 * raising CREATE_ACCEPTED_ATTEMPTS or either timeout moves this with them instead of leaving a
 * caller's hand-computed copy short.
 */
export function createPollBudget(remainingMs: number): number {
  const perPoll = POLL_COST_MS + MAX_ACCEPTED_WAIT_MS;
  const fits = Math.floor((remainingMs + MAX_ACCEPTED_WAIT_MS) / perPoll);
  return Math.max(0, Math.min(CREATE_ACCEPTED_ATTEMPTS, fits));
}

export async function getAccount(accountId: string): Promise<MetaApiAccount> {
  return metaApiJson<MetaApiAccount>(`${PROVISIONING_BASE}/users/current/accounts/${accountId}`);
}

// Replaces the investor password. MetaApi re-validates synchronously, so a bad one fails here
// with E_AUTH. `password`, `name` and `server` are all required by the PUT; login cannot change.
// Answers 204. The new password takes effect on the next deploy.
// The full ACCOUNT_SETTINGS body is sent, not just the password: MetaApi does not document
// whether the PUT merges or replaces, and under replace a partial body drops the g2 tier, the
// metadata, and metastatsApiEnabled (which cannot be re-enabled without re-billing the account).
// `resourceSlots` is in that same list and is why callers read the live account first: an account
// upsized at create time would be silently cut back to 1 by a PUT that assumed the default, and
// the next deploy would fail the way the create originally did.
export async function updateAccountPassword(input: {
  accountId: string;
  userId: string;
  server: string;
  password: string;
  /** Read off the live account, never assumed — see above. */
  resourceSlots: number;
}): Promise<void> {
  await metaApiFetch(`${PROVISIONING_BASE}/users/current/accounts/${input.accountId}`, {
    method: "PUT",
    transactional: true,
    acceptedAttempts: CREATE_ACCEPTED_ATTEMPTS,
    body: {
      name: accountName(input.userId),
      password: input.password,
      server: input.server,
      // platform and login are absent on purpose: MetaApi fixes both at creation.
      ...ACCOUNT_SETTINGS,
      resourceSlots: input.resourceSlots,
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

/** Tears the account down on its own; undeploying first is a wasted call. 404 = already gone. */
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

// The path segment is the MT version NUMBER (4/5), not the platform string, and there is no
// /users/current prefix. Response is broker name -> server names.
export async function searchServers(platform: BrokerPlatform, query: string): Promise<string[]> {
  const version = platform === "mt4" ? 4 : 5;
  const byBroker = await metaApiJson<Record<string, string[]>>(
    `${PROVISIONING_BASE}/known-mt-servers/${version}/search?query=${encodeURIComponent(query)}`,
  );
  const servers = Object.values(byBroker ?? {}).flat();
  return [...new Set(servers.filter((server) => typeof server === "string" && server))];
}

// MetaStats wants `YYYY-MM-DD HH:mm:ss.SSS` in BROKER time, not ISO — no `T`, no `Z`. Callers must
// encodeURIComponent each segment so the literal space survives as %20 (encodeURI does not).
export function formatMetaStatsTime(date: Date): string {
  return date.toISOString().slice(0, 23).replace("T", " ");
}

const TRADES_PAGE_SIZE = 1000;
/** Pages allowed for ONE window. Hitting this is not a failure — it is the signal to halve. */
const MAX_TRADE_PAGES = 100;
/** Total pages the whole walk may spend, splits included — the real stop on bisection. */
const MAX_TOTAL_PAGES = 400;
/** Below this span there is nothing left to halve — one day that dense is an anomaly. */
const MIN_SPLIT_MS = 24 * 60 * 60 * 1000;

// Closed trades in [startTime, endTime). `updateHistory=true` refreshes from the running terminal,
// so the account has to be deployed. A window denser than MAX_TRADE_PAGES is HALVED and each half
// read separately: truncating loses trades, and throwing makes computeSyncWindow re-request the
// same oversized window forever.
export async function fetchHistoricalTrades(input: {
  accountId: string;
  region: string;
  start: Date;
  end: Date;
  updateHistory?: boolean;
}): Promise<MetaStatsTrade[]> {
  const base = metastatsBase(input.region);
  // The terminal refresh happens once for the whole walk, not once per split sub-window.
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

  // A dense window's partial read is DISCARDED, not merged — the halves re-read the same range.
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
