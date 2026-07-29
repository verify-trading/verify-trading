#!/usr/bin/env node
/**
 * MetaApi smoke test for broker sync.
 *
 * Run: node scripts/broker-smoke.mjs            (reads .env.local itself)
 *
 *   (default)      READ-ONLY. Regions, existing accounts, billing balance and the live
 *                  rate card. Safe to re-run.
 *   --live         Full pipeline proof, and it SPENDS MONEY (~$4.20 in one-off fees:
 *                  a generated demo account plus the MetaApi account it is attached to).
 *                  Creates an MT5 demo, connects it with those credentials, deploys,
 *                  waits for CONNECTED, pulls historical trades, undeploys, deletes.
 *   --probe-cache  Open question from the spec: does historical-trades answer for an
 *                  UNDEPLOYED account when updateHistory=false? Read-only; needs an
 *                  existing account to probe.
 *
 * Never prints METAAPI_TOKEN.
 */

import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const TOKEN = process.env.METAAPI_TOKEN;
if (!TOKEN) {
  console.error("Missing METAAPI_TOKEN (expected in .env.local).");
  process.exit(1);
}

// Provisioning and billing use the DOUBLED domain; MetaStats uses the single one with a
// region segment. Swapping them yields DNS failures or a fake-certificate TLS error.
const PROVISIONING = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";
const BILLING = "https://billing-api-v1.agiliumtrade.agiliumtrade.ai";
const metastats = (region) => `https://metastats-api-v1.${region}.agiliumtrade.ai`;

const args = new Set(process.argv.slice(2));
const LIVE = args.has("--live");
const PROBE_CACHE = args.has("--probe-cache");

const DEMO_SERVER = "ICMarketsSC-Demo";
const DEPLOY_POLL_MS = 5_000;
const DEPLOY_TIMEOUT_MS = 10 * 60 * 1000;

const transactionId = () => crypto.randomUUID().replaceAll("-", "");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** MetaStats wants `YYYY-MM-DD HH:mm:ss.SSS`, and the space has to reach the wire as %20. */
const timeSegment = (date) => encodeURIComponent(date.toISOString().slice(0, 23).replace("T", " "));

async function api(url, { method = "GET", body, headers = {} } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      "auth-token": TOKEN,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!response.ok) {
    const message = json?.message ?? (typeof json === "string" ? json.slice(0, 200) : response.statusText);
    const error = new Error(`${method} ${url.replace(/\?.*/, "")} → ${response.status}: ${message}`);
    error.status = response.status;
    throw error;
  }
  return json;
}

/** POSTs need a transaction-id, and a 202 is polled by RE-SENDING the identical request. */
async function apiWrite(url, body, { method = "POST", attempts = 5 } = {}) {
  const id = transactionId();
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(url, {
      method,
      headers: {
        "auth-token": TOKEN,
        "transaction-id": id,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 202 && attempt < attempts) {
      await wait(1000 * attempt);
      continue;
    }
    const text = await response.text();
    const json = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(`${method} ${url} → ${response.status}: ${json?.message ?? text.slice(0, 200)}`);
    }
    return json;
  }
}

const money = (value) => `$${Number(value).toFixed(2)}`;
const readBalance = () => api(`${BILLING}/users/current/balance`);

async function readOnlyPass() {
  console.log("── MetaApi read-only smoke ──────────────────────────────────");

  const regions = await api(`${PROVISIONING}/users/current/regions`);
  console.log(`regions:  ${JSON.stringify(regions)}`);

  const accounts = await api(`${PROVISIONING}/users/current/accounts`, {
    headers: { "api-version": "2" },
  });
  const items = accounts?.items ?? [];
  console.log(`accounts: ${accounts?.count ?? items.length}`);
  for (const account of items) {
    console.log(
      `  - ${account._id}  ${account.platform ?? "?"}  ${account.server ?? "?"}  ` +
        `state=${account.state}  conn=${account.connectionStatus}  region=${account.region ?? "?"}  ` +
        `metastats=${account.metastatsApiEnabled}`,
    );
  }

  const balance = await readBalance();
  console.log(
    `balance:  ${money(balance.amount)} (trial ${money(balance.trialAmount)}, advance ${money(balance.advanceAmount ?? 0)})`,
  );

  // The live card, not our arithmetic on top of it: the cost model lives in
  // docs/broker-sync.md, and a hardcoded copy here would contradict this print the day
  // MetaApi reprices.
  const rates = await api(`${BILLING}/rates`);
  const card = rates?.london ?? rates?.regions?.london ?? rates;
  console.log(`rates:    effectiveFrom=${rates?.effectiveFrom ?? "?"}`);
  console.log(`          ${JSON.stringify(card).slice(0, 900)}`);

  return { accounts: items, balance };
}

/**
 * SPEC RISK from the integration spec: updateHistory=true needs a running terminal, but
 * it is undocumented whether the cached history answers while the account is parked. If
 * it does, a parked-most-of-the-time design becomes possible again.
 */
async function probeCache(accounts) {
  console.log("");
  console.log("── probe: historical-trades on a PARKED account (updateHistory=false) ──");
  const parked = accounts.find((account) => account.state === "UNDEPLOYED");
  if (!parked) {
    console.log("skipped: no undeployed account to probe. Re-run with one connected and parked.");
    return;
  }

  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  const url =
    `${metastats(parked.region ?? "london")}/users/current/accounts/${parked._id}` +
    `/historical-trades/${timeSegment(start)}/${timeSegment(end)}?limit=10&offset=0&updateHistory=false`;

  try {
    const payload = await api(url);
    console.log(`RESULT: 200 with ${payload?.trades?.length ?? 0} trades — cached history IS readable while parked.`);
  } catch (error) {
    console.log(`RESULT: ${error.message}`);
  }
}

async function livePass(balanceBefore) {
  console.log("");
  console.log("── live pipeline (this spends money) ────────────────────────");
  if (Number(balanceBefore.amount) + Number(balanceBefore.trialAmount) <= 0) {
    console.error("Billing balance is $0.00 — top up first. Every write below would fail on funds.");
    process.exit(1);
  }

  console.log(`creating an MT5 demo on ${DEMO_SERVER} …`);
  const demo = await apiWrite(`${PROVISIONING}/users/current/provisioning-profiles/default/mt5-demo-accounts`, {
    accountType: "type",
    balance: 1000,
    email: "smoke@verify.trading",
    leverage: 10,
    name: "verify.trading smoke",
    phone: "+12345678901",
    serverName: DEMO_SERVER,
    keywords: ["Raw Trading Ltd"],
  });
  console.log(`  demo login ${demo.login} on ${demo.serverName}`);

  // The config-link flow can't be automated (a human types on MetaApi's page), so the proof uses
  // a normal create with the demo's own investor password. NOTE: that means this run says nothing
  // about what state a CREDENTIAL-LESS account sits in — it never makes one. The engine reads that
  // off the account itself (DRAFT with no `login`); see UNCONFIGURED_STATE in src/lib/broker/sync.ts.
  const created = await apiWrite(`${PROVISIONING}/users/current/accounts`, {
    name: "verify.trading smoke",
    login: demo.login,
    password: demo.investorPassword,
    server: demo.serverName,
    platform: "mt5",
    magic: 0,
    type: "cloud-g2",
    reliability: "high",
    manualTrades: true,
    metastatsApiEnabled: true,
    tags: ["verify-trading-smoke"],
  });
  const accountId = created.id;
  console.log(`  account ${accountId} created in state ${created.state}`);

  try {
    await apiWrite(`${PROVISIONING}/users/current/accounts/${accountId}/deploy`, null);
    console.log("  deploying, polling every 5s (10 min ceiling) …");

    const deadline = Date.now() + DEPLOY_TIMEOUT_MS;
    let account;
    while (Date.now() < deadline) {
      account = await api(`${PROVISIONING}/users/current/accounts/${accountId}`);
      process.stdout.write(`    ${account.state}/${account.connectionStatus}\n`);
      if (account.state === "DEPLOYED" && account.connectionStatus === "CONNECTED") break;
      if (account.state === "DEPLOY_FAILED") throw new Error("deploy failed");
      await wait(DEPLOY_POLL_MS);
    }
    if (!(account?.state === "DEPLOYED" && account?.connectionStatus === "CONNECTED")) {
      throw new Error(`never connected: ${account?.state}/${account?.connectionStatus}`);
    }

    const region = account.region ?? "london";
    const end = new Date();
    const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
    const trades = await api(
      `${metastats(region)}/users/current/accounts/${accountId}` +
        `/historical-trades/${timeSegment(start)}/${timeSegment(end)}?limit=1000&offset=0&updateHistory=true`,
    );
    // A fresh demo has never traded: the 200 with an empty array IS the proof.
    console.log(`  historical-trades → 200, ${trades?.trades?.length ?? 0} trades (0 expected on a fresh demo)`);
  } finally {
    // Cleanup that FAILED must not print success: the account bills until it is gone and this log
    // is the only record of which id to remove by hand. The delete is attempted even if the
    // undeploy (production's `park()`) failed — the delete is what actually stops the billing.
    const failed = (promise) => promise.then(() => null, (error) => error?.message || "unknown error");
    const undeploy = await failed(apiWrite(`${PROVISIONING}/users/current/accounts/${accountId}/undeploy`, null));
    const removed = await failed(api(`${PROVISIONING}/users/current/accounts/${accountId}`, { method: "DELETE" }));
    if (undeploy) console.error(`  undeploy FAILED (this is production's park()): ${undeploy}`);
    if (removed) {
      console.error(`  DELETE FAILED — account ${accountId} still exists and is STILL BILLING: ${removed}`);
      process.exitCode = 1;
    } else {
      console.log(`  MetaApi account deleted${undeploy ? " (after the undeploy failed)" : ""}.`);
    }
    console.log(`  NOTE: the demo login ${demo.login} still exists at the broker; it expires on their schedule.`);
  }

  const balanceAfter = await readBalance();
  const spent = Number(balanceBefore.amount) - Number(balanceAfter.amount);
  console.log(`  balance ${money(balanceBefore.amount)} → ${money(balanceAfter.amount)} (spent ${money(spent)})`);
}

const { accounts, balance } = await readOnlyPass();
if (PROBE_CACHE) await probeCache(accounts);
if (LIVE) await livePass(balance);
