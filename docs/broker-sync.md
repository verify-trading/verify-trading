# Broker sync (MetaTrader via MetaApi)

A Pro trader connects one MT4/MT5 account. Their closed trades land in the journal as
day entries, refreshed twice a day. Implemented July 2026.

We never hold a broker credential: MetaApi hosts the page the trader types it on.

---

## The flow

1. **Pick a server.** `GET /api/broker/servers?platform=mt5&query=icmarkets` proxies
   MetaApi's known-server search. The exact MT server name has to be decided before the
   account exists, because MetaApi's hosted page collects login + password only.
2. **Create.** `POST /api/broker/account { platform, server }` creates the account at
   MetaApi **without credentials** (`cloud-g2`, high reliability, `metastatsApiEnabled:
   true`, `manualTrades: true`, `magic: 0`), requests a configuration link, and stores
   one row in `broker_accounts` — MetaApi's account id and
   the platform. The region column is left null: every sync reads it off the live snapshot
   and rewrites it, so asking for it here would be a round trip for a value that is
   overwritten before it is read. Returns the link.
3. **Configure.** The trader opens the link and enters their login + investor password
   on MetaApi's page. Nothing comes back to us, and there is no callback — we learn they
   finished by re-reading the account: a credential-less one sits in `state: DRAFT` with no
   `login`, and both change once the page is completed.

   Not `GET .../configuration-information`. That endpoint is documented as
   `readConfigurationInformationByConfigToken` and authenticates with the short-lived
   *configuration* token minted beside the hosted page, not the account-management token this
   service holds; called with ours it returns `400 ValidationError: "Configuration token does
   not match the account id (<traceId>)"`. Because the whole snapshot read went through it,
   every connect attempt threw and `awaiting_config` was unreachable in practice.

   `DRAFT` is documented only on MetaApi's create-account page and is absent from the
   TradingAccount model's `state` enum, so `login` being present is read as configured too —
   two independent signals off one response, rather than one undocumented string.
4. **Deploy.** The next sync — the trader's own "Sync now", or the `wake` cron pass —
   sees a configured, parked account and deploys it. It answers `linking` while the
   terminal starts and connects to the broker (30 s – 3 min, occasionally longer on the
   first history download).
5. **Import.** Once deployed and `CONNECTED`, MetaStats' historical-trades endpoint is
   paged (`limit=1000`, `updateHistory=true` on the first page only — the terminal refresh
   only has to happen before the first read of the window) over the sync window. Balance
   operations are dropped, the rest are grouped by close date, and each day is upserted
   into `journal_entries` with `source='broker'`.
6. **Park.** Only the `pull` pass undeploys, and it undeploys *everything* — the account it
   just imported from, a straggler that never connected, one a manual "Sync now" woke an
   hour ago. Nothing survives a pull deployed. See *Cadence* and *Cost*.
7. **Disconnect.** `DELETE /api/broker/account` parks the account at MetaApi (undeploy) and
   stamps `disconnected_at`. It does **not** delete: the $2.10 join fee is paid once ever, so
   the account and its row are kept and a reconnect wakes the same one for free. Not
   Pro-gated, and it proceeds even if MetaApi fails — getting out is always allowed.
   Imported journal days stay: they are the trader's record, not the connection's.
8. **Reconnect, or switch.** Connecting again with a parked account reads its live snapshot
   and compares `server` + `version` against what the trader picked:

   - **Same** → wake it. Free. This is the password-re-entry path.
   - **Different** → they mean a different broker account, which MetaApi cannot express on
     the existing one (server and platform are fixed at creation). Create a new account,
     re-point the row at it, then delete the old one. $2.10 again.

   Create happens **before** the delete, so a failed replacement leaves the trader on the
   account they already had rather than with nothing and the fee spent. The row's memory of
   the old account is cleared on a switch — `last_synced_at` above all, since
   `computeSyncWindow` starts from it and would otherwise begin the new account's history at
   the old one's last sync instead of pulling its 90 days.

   **Uncertainty never deletes.** An unreadable account, a MetaApi outage, or a missing
   `server`/`version` all resolve to "same account" and wake it. Deletion is irreversible and
   the fee is not refundable, so it fires only when MetaApi positively reported both fields
   and one of them differs.

   Journal days from the old account stay. If both accounts traded the same date the
   importer rewrites it (the `source='broker'` predicate matches either), so a shared day
   reflects whichever account is currently connected.

---

## State machine

There is no `state` column. State is derived from a live MetaApi snapshot on every
`GET /api/broker/account`, because a stored copy is wrong the moment a deploy lands or a
broker drops the session.

| Reported | When | Trader sees |
|---|---|---|
| `awaiting_config` | `configured: false` | "Finish connecting" + the link |
| `linking` | any in-flight state (`DEPLOYING`, `UNDEPLOYING`, `DELETING`, or a `DRAFT` that already carries a `login`), or `DEPLOYED` without `CONNECTED` | "Connecting…" |
| `ready` | `DEPLOYED` + `CONNECTED`, **or** parked (`UNDEPLOYED`/`CREATED`) | Normal |
| `error` | `*_FAILED`, or `DEPLOYED` + `DISCONNECTED_FROM_BROKER` | `stateDetail`, in plain words |

Parked reads as `ready` on purpose: it is a resting state, not a fault, and a
connectionStatus left over from the last deploy is stale while an account is parked. Every
in-flight state reads as `linking` for one reason: none of them is deployable, and a deployment
is billed per attempt whether MetaApi honours it or not.

`POST /api/broker/sync` runs one step of the same engine the cron runs — `409` while
awaiting config, `linking` if it had to deploy or is still connecting, `imported` with
day counts otherwise. A second tap inside 10 minutes of a **successful** sync returns
`imported 0/0` rather than paying the deployment fee again; a retry after a *failed* sync always
goes through, which is how a trader who fixed their password recovers without waiting.

---

## Mapping trades to journal days

- Only `DEAL_TYPE_BUY` and `DEAL_TYPE_SELL` survive. `DEAL_TYPE_BALANCE` is how
  deposits, withdrawals, credits and adjustments arrive — trade-shaped, with the cash
  amount in `profit`. Letting one through puts every deposit in the journal as a winning
  day, so the filter is a whitelist, not a blacklist.
- Days are cut on the broker's own close date. Broker clocks are typically EET with no
  offset published, so a trade closing near midnight can land on the neighbouring day.
  Known v1 ceiling.
- `pnl_amount` is the sum of `profit`. MetaStats has no per-trade commission or swap
  field, so an imported day is **gross of costs**. Trades are deduped by `_id` before
  grouping, so a paging hiccup can't double a day.
- **No per-trade blob is stored.** `trade_details` is the manual form's shape and mobile
  reads it as one; the raw MetaStats rows would be tens of KB a day through
  `GET /api/journal/entries` and nothing reads them. When a per-trade feature lands, the
  history is still re-pullable from MetaApi.
- First sync starts at **midnight UTC** 90 days back, not the current time of day —
  otherwise the oldest day imports a partial afternoon of P&L and is never read again.
- First sync reaches back 90 days. Later syncs start a day before the previous run so a
  trade that closed on the boundary is folded in; re-imports are idempotent.
- **A day the trader typed is never overwritten**, and the guard is in the database, not
  in application code: the importer inserts with `ignoreDuplicates` (existing rows are
  left alone, whoever owns them) and then rewrites only what matches
  `where source = 'broker'`. It never reads first — a read-then-write would leave a gap
  for a manual save to land in and be clobbered *and* relabelled `'broker'` for good.
  Days that matched nothing are counted in `skippedDays`. The moment a trader edits an
  imported day, the journal API stamps their own source on it and we stop writing to it.

---

## Cadence

TWO IDENTICAL cycles a day. A cycle is one pair of passes: wake the accounts, import 35
minutes later, park everything. Two `pg_cron` jobs (`supabase/migration_29_broker_cron.sql`
→ `/api/broker/cron`, bearer-authed with `CRON_SECRET` read from Vault):

| Pass | Schedule (UTC) | Does |
|---|---|---|
| `?pass=wake` | `0 6,18 * * *` | deploys every parked account whose owner is Pro |
| `?pass=pull` | `35 6,18 * * *` | imports from whatever connected, then **parks everything** |

**These are not scheduled yet.** Vercel's Hobby plan caps cron at one run per day across two
jobs, which cannot express two runs of a pair, so the `vercel.json` entries were removed and
migration 29 moves the trigger to `pg_cron` + `pg_net`. Until that migration is applied — it
needs two Vault secrets created first, see the file — the only sync that ever runs is the
trader's own "Sync now".

06:00 and 18:00 put one import after the Asia/London session and one after the New York
close, twelve hours apart. Nothing in the code reads a duration or a time: the schedule is
entirely in the migration.

**35 minutes is headroom, not a measurement.** A deploy takes 30 s – 3 min, occasionally
longer on the first history download, and a serverless function shouldn't sit there waiting
for it — hence two passes rather than one that sleeps. Accepted trade-off: an account that
*consistently* takes longer than 35 minutes to connect misses the cron imports entirely and
depends on the trader's own "Sync now". It is still parked by the pull, so it costs nothing
extra; widen the gap in the migration if it ever shows up in practice.

**Only `wake` checks Pro** (one batched read of `profiles.tier`, the same entitlement
`hasProAccess` gates the API on) — otherwise a lapsed subscription keeps deploying at
~$5.60/month for a feature nobody is paying for. That read **fails closed**: if it errors the
whole pass throws and nobody is deployed, rather than an unknown tier being billed as Pro.

**`pull` deliberately does not check Pro.** Parking is the whole point of it and has to run
for everyone. Accepted trade-off: a trader who lapses between a manual "Sync now" and that
evening's pull gets ONE more import into their journal before the account is parked — bounded,
and cheaper than the alternative of a tier read that could skip the parking. Their next manual
sync is already 403'd by the route's Pro gate, and a lapsed account then sits parked
(~$0.72/month) until they resubscribe, keeping its imported days.

**`pull` is the self-heal.** No account survives it deployed, whatever woke it, whatever state
it is in. It also never *starts* a deployment: an account still parked at pull time waits for
the next wake rather than paying a fee for a cycle that is over. One account's failure never
stops the pass, and a pass killed by the 300 s cap leaves at most 12 hours of deployed hours
behind, because the next pull parks the tail.

---

## Cost

Live rate card (`GET billing-api-v1/rates`, effective 2026-01-10), cloud-g2 high
reliability, london/new-york. `scripts/broker-smoke.mjs` reprints it live — it is the
source of truth; the arithmetic below is not repeated there so the two can't drift.

| Line | Rate | Per trader / month |
|---|---|---|
| Deployments | $0.0756 each | **$4.54** (2/day, ≈$0.15/day) |
| Deployed hosting | $0.0126 /hr | $0.45 (≈1.2 h/day, ≈$0.015/day) |
| Parked hosting | $0.00105 /hr | $0.72 (the other ~22.8 h/day, ≈$0.024/day) |
| MetaStats add-on | $0.001575 /hr | $0.06 – $1.13 (unclear whether it bills while parked) |
| Adding a trading account | $2.10 | one-off at connect |
| Failed account validation | $0.105 each | only on a bad login |
| Subscription / monthly minimum | **$0** | — |

**≈ $5.60 per connected trader per month** (≈$0.19/day), plus $2.10 once at connect. The
deployment fee dominates: hosting is loose change either side of it. Leaving the account up
permanently instead would be ~$9.20/month.

**MetaApi is prepaid, and the balance is currently $0.00** (`GET billing-api-v1/users/current/balance`
→ `{"trialAmount":0,"amount":0,"advanceAmount":0}`, checked 2026-07-29). A zero balance
rejects every write — deploy, create, all of it — so nothing here can run end to end until it
is topped up. Check this before diagnosing a broker failure as a bug: no product code reads
the endpoint, only `scripts/broker-smoke.mjs`.

**Future optimization, untested** (`node scripts/broker-smoke.mjs --probe-cache`): whether
MetaStats answers `historical-trades` for a **parked** account with `updateHistory=false`. If
it does, `wake` disappears entirely — pull reads straight from the parked account and the bill
drops to parked rent alone, ~$1/month.

---

## Security posture

- **No broker credential is ever stored, sent to us, or logged.** The trader types it on
  MetaApi's hosted page; MetaApi will not disclose it, including to us. A password change
  is handled by re-issuing the configuration link.
- Investor (read-only) passwords are what the connect screen asks for. An investor
  password cannot place a trade or move money.
- `METAAPI_TOKEN` is server-side only and never logged or echoed.
- `broker_accounts` is owner-read via RLS; every write goes through the service role.
  Same trust model as `profiles.tier`.
- All routes except the cron are authenticated and Pro-gated — at ~$5.60/month per
  connected account, a free user connecting one is permanently negative margin.
