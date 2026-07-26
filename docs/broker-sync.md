# Broker Sync + Verified Trader

Research and implementation plan. Written July 2026.

**The call in one line:** use **MetaApi** for MT4/MT5, run a **once-daily batch** sync into a
**new `broker_trades` table** (never into `journal_entries`), gate it behind Pro, and ship
**one connected account per user, closed trades only**. SnapTrade is the runner-up and belongs
in a later phase, not v1.

Every price and capability claim below carries a URL. Where a number could not be confirmed
from a primary source it says so explicitly rather than guessing.

---

## 1. Competitor landscape

Source for the ranking column: [journalplus.co — Best Trading Journals with Auto Broker Sync
2026](https://journalplus.co/best/trading-journal-with-broker-sync/). **Bias warning:** that page
is published by JournalPlus and ranks JournalPlus #1. Its competitor pricing is checkable and
broadly matches the vendors' own pages; its self-assessment is marketing. Treated as a starting
map, not evidence.

| Product | Pricing | Sync mechanism | Brokers | MT4/MT5? | Notes |
|---|---|---|---|---|---|
| **TradeZella** | $49/mo or $399/yr ([journalplus](https://journalplus.co/best/trading-journal-with-broker-sync/)) | Real-time API for US brokers; **MT4/MT5 via investor password auto-sync**, HTML file as fallback ([TradeZella help](https://help.tradezella.com/en/articles/8672972-link-your-metatrader-4-5-account-with-tradezella)) | 8+ US via API; **500+ brokers** claimed incl. prop-firm accounts ([TradeZella](https://www.tradezella.com/blog/connect-mt4-mt5-trading-journal)) | **Yes** | The direct competitor for our audience. Pulls full closed history, open positions, swap, commission, SL/TP. States plainly: investor password is read-only, they cannot trade or withdraw. |
| **TraderSync** | $29.95/mo Pro, $49.95/mo Premium ([tradersync.com/pricing](https://tradersync.com/pricing/)) | **Batch** API, not real-time, for most brokers | ~10 via API; 700–930 claimed incl. CSV templates | Yes, but MT5 is documented as **CSV/export** import ([TraderSync MT5](https://tradersync.com/broker/metatrader_5_mt5/)) | Strongest options-chain parsing. Full API sync gated to Premium. |
| **Tradervue** | $29/mo Silver, $49/mo Gold | Primarily **end-of-day file upload**, limited API | 40+ file formats | File-based | The oldest and most battle-tested import pipeline; weakest on live API sync. |
| **TradeMetria** | $19.99/mo or $199/yr | API + CSV | 12+ incl. international | Yes | Positioned at non-US brokers. Sync reliability reported as inconsistent. |
| **JournalPlus** | $159 one-time | Real-time API + CSV | 15+ (Schwab, IBKR, Webull, Robinhood, Fidelity, Zerodha, Trading212) | Not listed | Self-ranked #1 on its own page. Broker list is equities-flavoured, not prop/forex. |
| **Myfxbook / FX Blue** | Free | **Investor password**, polled several times daily | Any MT4/MT5 broker | Yes, exclusively | Not journals — the *verification* precedent. See §5. |

**What the landscape actually says:**

1. For a prop-firm/retail-forex audience, MT4/MT5 investor-password sync is the table stakes
   feature, and TradeZella is the only journal in the list that does it well.
2. Nobody's "500+ brokers" is 500 integrations. It's one MT4/MT5 integration multiplied by the
   number of brokers running an MT server. That is exactly why this is tractable for us.
3. Broker API migrations break sync. The May 2024 TD Ameritrade→Schwab migration disrupted
   several of these platforms for 2–6 weeks
   ([journalplus](https://journalplus.co/best/trading-journal-with-broker-sync/)). Any equities
   integration needs a manual fallback from day one. MT4/MT5 has no such migration risk — the
   protocol has been stable for over a decade.

---

## 2. Integration options

### The audience decides this

Over **70% of prop firms offer MT5**, and MT5 is the single most widely supported prop platform
([Finance Magnates, Top Trading Platforms for Brokers in
2026](https://www.financemagnates.com/forex/top-trading-platforms-for-brokers-in-2026/);
[track360 prop platform
comparison](https://track360.io/blog/prop-firm-trading-platform-comparison-dxtrade-ctrader-match-trader-2026)).
Our `challenge_config` table already models a prop challenge (`firm_name`, `account_size`,
`account_type`, `rules`), so the product is already pointed at this user. **The MT4/MT5 path is
not one option among five — it is the only one that serves the users we have.**

### Options assessed

| Option | Cost | Credential the user hands over | Read-only? | Transport | Limits |
|---|---|---|---|---|---|
| **MetaApi** (MT4+MT5) | Pay-as-you-go, per account-hour — see §6. MetaApi API itself is **free**; you pay for account hosting ([metaapi.cloud](https://metaapi.cloud/)) | MT **login + server + password**. MetaApi documents the password field as accepting an **investor (read-only) password** and recommends it where possible ([managingAccounts docs](https://github.com/metaapi/metaapi-javascript-sdk/blob/main/docs/metaApi/managingAccounts.md)) | **Yes, with investor password** — read balance, positions, orders, and full deal history; no trade rights | REST + WebSocket streaming. Accounts are explicitly `DEPLOYED`/`UNDEPLOYED`, and you are billed differently for each — this is the main cost lever | Dedicated servers and higher rate limits on paid tier; >250 accounts requires the Business subscription ([metaapi.cloud](https://metaapi.cloud/)) |
| **SnapTrade** (US equities/crypto) | **$2 per connected user/month** pay-as-you-go, unlimited users; **free tier = 5 total brokerage connections** ([snaptrade.com/pricing](https://snaptrade.com/pricing)). A cheaper daily-data tier is listed on the same page. | Nothing, for OAuth brokers — SnapTrade hosts the connection portal. Credential-based only for its `UNOFFICIAL_API` brokers (Webull, Wealthsimple, Vanguard), and **SnapTrade holds those, not us** | Per broker. Robinhood and Fidelity are read-only in practice | REST + **webhooks** (`TRADE_DETECTION`, `CONNECTION_BROKEN`, etc.) ([webhooks docs](https://docs.snaptrade.com/docs/webhooks)) | 250 req/min customer-wide ([rate limiting](https://docs.snaptrade.com/docs/ratelimiting)). **Transactions are T+1 on every published plan**; intraday needs the Orders endpoint ([syncing docs](https://docs.snaptrade.com/docs/syncing)). Real-time `TRADE_DETECTION` is a **sales-gated, unpriced** add-on. Access tokens expire in weeks — reconnect is a routine flow. |
| **cTrader Open API** | Free to any developer; account holders at any cTrader-affiliated broker can connect ([cTrader Open API](https://help.ctrader.com/open-api/)) | **Nothing — OAuth 2.0.** Scope `accounts` grants data-only access; scope `trading` grants full access ([account authentication](https://help.ctrader.com/open-api/account-authentication/)) | **Yes** with `accounts` scope. Best credential posture of any option here | Protobuf over TCP/WebSocket, streaming | Not published; app registration + redirect URI required |
| **DXtrade / Match-Trader / TradeLocker** | **Could not confirm** — no public self-serve pricing or open developer program found. These are broker/prop-firm-facing platforms; access appears to require a partnership with the firm running the instance, not the individual trader | n/a | n/a | n/a | **Treat as blocked on business development, not engineering.** |
| **Direct broker read-only API keys** (IBKR Flex, Coinbase, Binance, Bybit, Kraken) | Free | A genuinely read-only, user-generated API key | **Yes** | REST poll | Per-broker. Zero vendor cost, but one integration per broker and a power-user-only UX |

### Recommendation: **MetaApi**

Because:

1. **It's the only option that reaches the users we actually have.** One integration covers every
   MT4/MT5 broker and the large majority of prop firms. SnapTrade covers ~26 brokers, none of
   which are MT4/MT5 or a prop firm.
2. **The read-only story is clean and already understood by the audience.** Forex traders have
   been handing investor passwords to Myfxbook since 2009. It is a familiar, expected ask — not a
   scary new one. And an investor password genuinely cannot place a trade or withdraw.
3. **It matches what the closest competitor does.** TradeZella's MT4/MT5 sync is investor-password
   based ([help doc](https://help.tradezella.com/en/articles/8672972-link-your-metatrader-4-5-account-with-tradezella)).
   We would be at parity on the feature that matters, not chasing them across 500 equities brokers.
4. **The unit cost is controllable.** Because MetaApi bills deployed vs undeployed hours
   separately, a batch design costs roughly a third of an always-on one. See §6.

**Runner-up: SnapTrade.** Better credential posture (OAuth, we never touch a password), SOC 2
Type II, AWS KMS, and dead-simple $2/user pricing ([security](https://snaptrade.com/security)).
It is the obviously right answer *for a US equities journal*. It is the wrong answer for a
prop-firm journal because it does not cover the platform 70% of prop firms run. **Phase 3, when
and if the user base shifts.**

**Honourable mention: cTrader Open API.** OAuth, free, read-only scope — strictly better security
than MetaApi. It only loses on reach. Worth adding as the *second* integration precisely because
it costs nothing per account and requires storing nothing.

---

## 3. What our codebase forces on the design

Read before designing anything: **`journal_entries` is one row per user per day.**

```sql
-- database/migrations/20260528_mobile_journal_psychology.sql
create unique index if not exists journal_entries_user_entry_date_key
  on public.journal_entries (user_id, entry_date);
```

And `POST /api/journal/entries` is a **whole-row upsert that overwrites that day**:

```ts
// src/app/api/journal/entries/route.ts
.upsert({ user_id, entry_date, mood, pnl_amount, ..., source: "mobile" },
        { onConflict: "user_id,entry_date" })
```

A broker sync produces *N trades per day*. The two models do not fit in one table, and any design
that tries to write synced trades into `journal_entries` will either lose trades or have the
mobile client's next save silently destroy imported data.

**So: broker trades never touch `journal_entries`.** They go in a new table and are joined on
read. This is the single most important decision in this document.

Other facts the plan builds on:

- **`journal_entries.source`** already exists (`text not null default 'mobile'`). Free labelling.
- **Supabase Vault is already the encrypted-at-rest precedent.** `20260508_supabase_markets_cron.sql`
  enables `supabase_vault` and reads `vault.decrypted_secrets` from inside a `pg_cron` job.
- **The cron pattern already exists**: `pg_cron` + `pg_net` → `net.http_get` to
  `/api/cron/markets` with a `Bearer` secret pulled from Vault. Vercel `vercel.json` has **no**
  `crons` block — scheduling lives in Postgres. Reuse it verbatim.
- **No user-owned third-party credential is stored anywhere today.** Every existing secret is a
  service secret in `process.env` or Vault. Broker credentials would be a new data class with a
  new risk profile.
- **`profiles.tier text check (tier in ('free','pro'))`** is the only entitlement, and it is
  service-role write only (`supabase/migration_3.sql`). Nothing backs a "Verified Trader" badge today.
- **The mobile placeholder already exists**: `src/features/journal/ConnectBrokerSheet.tsx` exports
  `ConnectBrokerButton` (the ⋮ in the entry drawer) and `ConnectBrokerSheet` (a static explainer
  that already promises "auto-import your real trades and earn your Verified Trader badge"). The
  copy is written. Only the flow is missing.

---

## 4. Phased implementation

### Phase 1 — Connect + daily import (the whole of v1)

**Schema** — one migration, `database/migrations/2026XXXX_broker_sync.sql`:

```sql
create table if not exists public.broker_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'metaapi',
  provider_account_id text not null,          -- MetaApi accountId; the only handle we keep
  login text not null,                        -- MT login, display only
  server text not null,
  platform text not null check (platform in ('mt4','mt5')),
  account_kind text,                          -- 'live' | 'demo', as reported by the broker
  currency text,
  status text not null default 'pending'
    check (status in ('pending','connected','broken','revoked')),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists broker_accounts_user_provider_key
  on public.broker_accounts (user_id, provider, provider_account_id);
-- v1: one account per user. Drop this index when multi-account ships.
create unique index if not exists broker_accounts_one_per_user
  on public.broker_accounts (user_id) where status <> 'revoked';

create table if not exists public.broker_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  broker_account_id uuid not null references public.broker_accounts(id) on delete cascade,
  external_id text not null,                  -- MT deal / position ticket
  symbol text not null,
  side text not null check (side in ('buy','sell')),
  volume numeric(14,4) not null,
  open_price numeric(18,8),
  close_price numeric(18,8),
  opened_at timestamptz,
  closed_at timestamptz not null,
  profit numeric(14,2) not null,              -- broker-reported, net of swap+commission
  commission numeric(14,2) not null default 0,
  swap numeric(14,2) not null default 0,
  currency text not null,
  entry_date date not null,                   -- date(closed_at); the join key to journal_entries
  raw jsonb,
  created_at timestamptz not null default now()
);
-- THE dedupe. Idempotent re-sync is a database constraint, not app code.
create unique index if not exists broker_trades_account_external_key
  on public.broker_trades (broker_account_id, external_id);
create index if not exists broker_trades_user_date_idx
  on public.broker_trades (user_id, entry_date desc);

alter table public.journal_entries
  add column if not exists pnl_source text not null default 'manual'
    check (pnl_source in ('manual','broker'));

alter table public.profiles
  add column if not exists verified_trader_at timestamptz;
```

RLS: owner-read on both new tables (`user_id = auth.uid()`), **no client insert or update on
either** — only the service-role sync job writes. Mirrors how `profiles.tier` is handled.

**Dedupe strategy** — three separate problems, three answers:

1. **Sync re-runs importing the same trade.** Solved by the DB: unique
   `(broker_account_id, external_id)`, and the sync does `upsert ... on conflict do update`. Poll
   overlap is free; no cursor bookkeeping required for correctness. `last_synced_at` is an
   optimisation, not a guarantee.
2. **Broker trades vs manually-typed entries.** They live in different tables, so they *cannot*
   collide. The daily journal entry stays the human artifact — mood, note, lesson, tags. The trade
   rows are the machine record. `GET /api/journal/entries` gains a per-day rollup
   (`brokerPnl`, `tradeCount`) computed from `broker_trades`, returned alongside `entries`.
3. **Two P&L numbers for the same day.** Broker wins, and one guard in the existing POST handler
   enforces it: if `broker_trades` exist for `(user_id, entryDate)`, ignore the client's
   `pnlAmount`, write `null`, and set `pnl_source = 'broker'`. Mobile then renders the rollup
   instead of the typed figure. One `if`, in the one place every save routes through.

   **Backfill does not rewrite history.** On first connect, import the last 90 days into
   `broker_trades` and leave existing manual entries untouched except for flipping `pnl_source`.
   The trader sees "34 of your logged days now show broker P&L" — a fact, not a silent deletion.

**API routes** (all under `src/app/api/broker/`):

| Route | Does |
|---|---|
| `POST /api/broker/accounts` | Body: `{ platform, login, server, password }`. Provisions the MetaApi account, verifies it connects, inserts `broker_accounts`, kicks one immediate sync. **Never persists the password** (see §7). Returns account status only. |
| `GET /api/broker/accounts` | Status list for the sheet: login, server, status, `lastSyncedAt`, trade count. |
| `DELETE /api/broker/accounts/[id]` | Removes the MetaApi account, marks `revoked`. **Keeps `broker_trades`** — it's the user's history. Clears `verified_trader_at`. |
| `POST /api/broker/accounts/[id]/sync` | Manual "Sync now". Rate-limit **1 per hour per account** — each MetaApi deploy costs money (§6). |
| `GET /api/cron/broker-sync` | The `pg_cron` target. Bearer-secret auth, copied from `/api/cron/markets`. |

**Sync job + cadence.** New `pg_cron` entry alongside `refresh-market-cache`, same
`vault.decrypted_secrets` → `net.http_get` shape:

```sql
select cron.schedule('broker-sync', '0 22 * * *', $$ ... net.http_get('/api/cron/broker-sync') ... $$);
```

Daily at **22:00 UTC** (after the NY close, before the Sydney open). Per account the job:
`deploy → wait for connection → fetch deals since last_synced_at - 48h (overlap is free, see
dedupe #1) → upsert broker_trades → flip pnl_source on affected days → undeploy → stamp
last_synced_at`.

Deploy/undeploy per run rather than staying connected is deliberate and is worth **~$5.70 per
account per month** (§6). It also caps the blast radius: an account is only live for minutes a day.

### Phase 2 — Verified Trader badge + polish

Badge write (§5), reconnect flow when `status='broken'`, and cTrader Open API as the second
integration (OAuth, free, nothing to store).

### Phase 3 — SnapTrade

Only if the user base moves toward US equities/crypto. $2/user/month, OAuth, and a genuinely
different set of engineering problems (T+1 transactions, weeks-long token expiry, reconnect as a
routine flow).

### Mobile

The hook point exists. `src/features/journal/ConnectBrokerSheet.tsx`:

- `ConnectBrokerButton` stays exactly as is — the ⋮ in the entry drawer.
- `ConnectBrokerSheet` swaps its static explainer for three states: **not connected** (the current
  copy + a "Connect" CTA), **form** (platform toggle, login, server, investor password, with the
  read-only explanation inline and prominent), **connected** (login, server, last sync, trade
  count, "Sync now", "Disconnect").
- The entry drawer's P&L field becomes read-only and prefilled when the day has broker trades,
  with a "from your broker" label.
- Nothing else in the journal UI changes. Mood, note, lesson, tags stay manual — they always were
  the point.

---

## 5. Verified Trader badge

**Nothing backs this today.** `profiles.tier` is the only entitlement, it's service-role write
only, and it only knows free/pro.

**Mechanics:**

- **Flag:** `profiles.verified_trader_at timestamptz` (added in the Phase 1 migration).
- **Written by:** the sync job only, under the service role. Never by the client, never by RLS.
  Same trust model as `tier`.
- **Set when** all of: a `broker_accounts` row is `status='connected'`, at least one
  `broker_trades` row has been imported, and `last_synced_at` is within 30 days.
- **Cleared when** the connection is revoked, or has been `broken` for more than 30 days. A badge
  that survives its own evidence is a lie with a timestamp.

**What it can honestly claim:**

> The P&L shown for connected days was read from this trader's broker server, not typed in.

**What it must not claim, and why:**

1. **Not "this is their whole record."** A trader can connect one winning account and never mention
   the three blown ones. Verified means *this data is real*, never *this data is complete*.
2. **Not "they own this account."** An investor password can be handed over by anyone. Myfxbook
   solves this with a second step requiring the **master** password — changing the investor
   password, or placing a pending order — to prove trading privileges
   ([Myfxbook verification](https://www.myfxbook.com/help/knowledge-base/verification/)). We are
   not doing that in v1, so the badge cannot assert ownership.
3. **Not "this is a funded live account."** Demo and prop-challenge servers report the same shape
   of data. Show `account_kind` next to the badge.
4. **Not "the numbers are audited."** They come from the broker. A B-book broker reports whatever
   it reports. FX Blue is careful about exactly this distinction — "verified" there means the data
   came directly from the broker, nothing more
   ([FX Blue](https://www.fxblue.com/live/about-verification)).

**So the badge is never bare.** It always renders with: platform, server name, live/demo, and the
date range covered. "Broker-Verified · MT5 · FTMO-Server · live · since 12 Mar 2026" is honest.
A gold tick is not.

---

## 6. Cost model

MetaApi bills per account-hour, and **deployed and undeployed are priced 11× apart**. All figures
from the pricing section of [metaapi.cloud](https://metaapi.cloud/), `g2` cloud offering:

| Line item | g2 | g1 |
|---|---|---|
| Deployed (active) account hosting | **$0.012** /acct/hr | $0.039376 /acct/hr |
| Undeployed (inactive) hosting | **$0.00105** /acct/hr | $0.00105 /acct/hr |
| Account deployment | **$0.072** per deployment | $0.23625 |
| Adding an account to the cloud | **$2.10** per unique account, charged once per month | $2.10 |
| MetaApi API itself | **Free** | Free |
| MetaStats API | $0.001575 /acct/hr | $0.001575 /acct/hr |

**Two architectures, costed** (730 hr/month, g2):

- **Always deployed** (streaming, trades appear in seconds):
  730 × $0.012 = **$8.76 /account/month**
- **Daily wake** (deploy ~30 min once a day — the recommended design):
  715 × $0.00105 undeployed ($0.75) + 15 × $0.012 deployed ($0.18) + 30 × $0.072 deploys ($2.16)
  = **≈ $3.09 /account/month**

Note the deployment *fee* dominates the batch design, not the compute. Syncing twice a day roughly
doubles it. Syncing weekly drops it to ~$1.10 but is too stale to be a product.

| Connected accounts | MetaApi, daily wake | MetaApi, always-on | SnapTrade equivalent |
|---|---|---|---|
| 100 | **~$310 /mo** | ~$876 /mo | ~$200 /mo |
| 1,000 | **~$3,090 /mo** | ~$8,760 /mo | ~$2,000 /mo |
| 5,000 | **~$15,450 /mo** | ~$43,800 /mo | ~$10,000 /mo |

Plus a one-off **$2.10 per account** in its first month.

**Caveats, stated plainly:**

- **The 1,000 and 5,000 rows are list-price upper bounds.** MetaApi states that workloads above
  **250 trading accounts** need the Business subscription with "customizable infrastructure",
  "volume discounts" and an SLA — and publishes **no** figures for it ([metaapi.cloud](https://metaapi.cloud/)).
  The real 1k/5k numbers require a sales conversation. Have it before the 250th account, not after.
- The SnapTrade column is priced at the confirmed **$2 per connected user/month** pay-as-you-go
  rate ([snaptrade.com/pricing](https://snaptrade.com/pricing)) and is shown for comparison only —
  SnapTrade does not cover MT4/MT5, so it is not substitutable for this audience.
- SnapTrade's Custom tier is "volume-based" with no published figures.

**The commercial consequence is unavoidable and should be decided now:** at ~$3/account/month,
broker sync costs more per user than most of the rest of the stack. **Gate it behind
`profiles.tier = 'pro'`.** A free user connecting a broker account is a permanent negative-margin
customer. The entitlement check already exists and is one line.

---

## 7. Security requirements

**Today's baseline:** no user-owned third-party credential is stored anywhere in this codebase.
Every secret is a service secret, in `process.env` or in Supabase Vault. Broker credentials are a
new data class. Treat the first one stored as a step change in liability, because it is.

**The strongest requirement, and the laziest: don't store the password at all.**

MetaApi must hold the MT credential — it has to log into the MT server. Once the account is
provisioned, MetaApi returns an `accountId`, and every subsequent operation uses that plus our
service API token. **We have no operational need for a second copy of the user's password.** So:

- `POST /api/broker/accounts` accepts the password, forwards it to MetaApi, keeps only the returned
  `provider_account_id`, and lets the plaintext fall out of scope.
- Reconnecting after a password change requires re-entry. That is a few seconds of user friction
  in exchange for having no user-credential store to breach, no key rotation policy to write, and
  nothing to disclose if we're compromised.
- Vault continues to hold only **service** secrets — the MetaApi API token and the cron bearer —
  via the existing `vault.create_secret` / `vault.decrypted_secrets` pattern from
  `20260508_supabase_markets_cron.sql`, read inside a `security definer` function or the cron job,
  never through an RLS-exposed view.

If a future phase genuinely needs stored credentials, Vault is the precedent and the answer — but
v1 does not need it, so v1 should not have it.

**Non-negotiable regardless:**

- **Investor password only.** We cannot technically distinguish an investor password from a master
  one, so this is enforced by UI copy and by the terms. Say it at the point of entry, in the
  sheet, not buried: *"Use your investor (read-only) password. We can read your trade history. We
  cannot place trades or move money."* If a user pastes a master password, that is their risk — but
  we must have told them clearly, once, at the moment it mattered.
- **Never log, never echo, never return.** The password appears in exactly one request body and
  one outbound call. Not in `logger` calls, not in error messages, not in any API response, not in
  Sentry breadcrumbs. Add an explicit redaction test.
- TLS-only submission (already true), and the field is `secureTextEntry` with autofill disabled.
- RLS: `broker_accounts` and `broker_trades` are owner-read, service-role-write. No client writes.
- **Vendor oversight of MetaApi** is a real obligation, not a formality — see below.

**Compliance reality:**

- The FTC's expanded reading of GLBA treats consumer fintech apps that access financial account
  and transaction data as **financial institutions**, which pulls us into the **Safeguards Rule
  (16 CFR Part 314)**: a written information security program, a named responsible individual, risk
  assessment, encryption in transit and at rest, access controls, incident response, and
  **contractual oversight of service providers**
  ([Cooley](https://cdp.cooley.com/fintech-faces-expanded-applicability-of-glbas-privacy-and-security-requirements/)).
  Not storing credentials shrinks this surface substantially. It does not remove it — we still
  store the resulting financial data.
- **SOC 2 Type II is table stakes, not law.** No statute requires it; aggregators, brokers and
  enterprise buyers ask for it. SnapTrade has it ([snaptrade.com/security](https://snaptrade.com/security)).
  Needed before Phase 3, not before Phase 1.
- **Does read-only change the risk profile?** Materially, yes — a leaked investor password cannot
  drain an account. But it still exposes full position history, size, balance and broker
  relationship, which is commercially sensitive and, in aggregate, a credential-stuffing corpus.
  "Read-only" is a reason to be less afraid, not a reason to be careless.

---

## 8. What I'd cut for v1

Everything below is deliberately deferred. Each line names what unblocks it.

1. **SnapTrade, US equities, crypto — all of it.** Zero overlap with the prop-firm audience we
   have. *Add when* signup data shows equities traders are a real segment.
2. **Real-time / streaming sync.** Always-deployed accounts cost 2.8× more (§6) for a benefit
   nobody journalling their day actually needs. Daily batch. *Add when* a user asks twice.
3. **Storing the investor password.** §7. *Add when* an operation genuinely requires re-auth
   without the user present — and probably never.
4. **cTrader, DXtrade, Match-Trader, TradeLocker.** MT5 alone reaches >70% of prop firms. The
   latter three appear to need firm-level partnerships, which is BD work, not engineering. *Add
   cTrader when* MT5 sync is stable — it's OAuth, free, and stores nothing, so it's the cheapest
   second integration by far.
5. **Multiple connected accounts per user.** One account, enforced by a partial unique index that
   is one line to drop. *Add when* users complain — prop traders running several challenges will,
   fairly quickly.
6. **Open positions.** Closed deals only. Open positions mean live data, which means staying
   deployed, which is the expensive architecture. *Add when* it justifies the always-on cost.
7. **Rewriting historical manual entries.** Backfill 90 days into `broker_trades`, flip
   `pnl_source`, touch nothing the user wrote. *Never* silently overwrite a trader's own record.
8. **Ownership proof for the badge (the Myfxbook master-password step).** v1's badge attests data
   provenance, not ownership, and the copy must say so. *Add when* the badge becomes publicly
   visible or socially comparative — at that point unproven ownership becomes exploitable.
9. **Multi-currency conversion.** `broker_trades.currency` is stored; the existing
   `dominantCurrency` behaviour in `computeJournalAggregates` already handles the blended case the
   same way it does today. *Add when* FX conversion is added for manual entries too.
10. **A public/web Verified Trader surface.** Mobile only. There is no public profile page to put
    it on. *Add when* one exists.
