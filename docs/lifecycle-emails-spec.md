# Lifecycle Emails — Build Spec

Status: ready to build · Written 15 Oct 2026 · Replaces `docs/email-flows-v2-simplified.md`

Three behaviour-triggered email flows (Activation, Conversion, Retention), 15 emails, sent through Resend. Our backend decides who gets what and when; Resend only delivers.

**Sources:** the client's build spec (Claude Doc "Lifecycle Email Build Spec (Resend)", 10 Oct 2026) and the client's email demo (https://claude.ai/artifact/Fe6EQ1nxJK4172Ey4gCGxj), which has the final copy and HTML for every email. Where this spec differs from those, this spec wins. The differences are listed in [Decisions](#1-decisions).

---

## 1. Decisions

Where we deliberately differ from the client's spec, and why.

| Client spec | We do | Why |
|---|---|---|
| E1 when the account is created | E1 = the existing signup welcome, unchanged (sent on email confirmation, migrations 22 + 23) | Already live and covered. Only confirmed addresses get mail. |
| C5 on the first paid invoice (`invoice.paid`) | C5 on `customer.subscription.created` with Pro access, including `trialing` (existing app flow) | Matches how the app grants Pro. A trial user is Pro from day one. |
| C4 Trial ending (Stripe `trial_will_end`) | Not built. C4 is now a **Pro day-3 check-in**: 3 days after Pro starts, points them at the features to set up | We don't handle trial-ending emails. The check-in uses data we already have. |
| Sender `hello@` on a new subdomain | `ai@verify.trading` (flows), `pro@verify.trading` (C4, C5), from the existing env config | Domain is already verified in Resend and sending. No DNS work. |
| `email_events` table + Resend webhook + weekly report | Not built. Resend dashboard + UTM tags. Resend's own suppression list handles bounces and complaints. | `email_sends` + `usage_limits` give the weekly report as a plain query later, without a new table. |
| `is_internal` flag | Not built. test mode (`LIFECYCLE_EMAIL_TEST_TO` allowlist) during testing. | Team accounts receiving emails in live mode is harmless. |
| `signup_platform` column | Not built | Only needed for the future app-specific welcome video. |
| R2 only for users who have "used the app" | R2 on the 3rd active day, links to both stores | We don't record app usage yet. Add the condition later. |
| E1 welcome video | Not in v1. Text + button. | Add when the video is ready. |
| C1/C3 fired from the code that increments usage | Picked up by the 15-minute job | Meets the spec's "within 15 minutes" with one code path instead of two. |
| Activity = rows in `chat_messages` | Activity = rows in `usage_limits` with `query_count > 0` | Users can delete their chats (cascades to `chat_messages`), and message saving is best-effort. `usage_limits` can't be deleted by users and covers web + app. `chat_messages` is used only to read the first question's text for the topic. |

Scope: only users who sign up on/after `POLICY.startDate` (config.ts, 15 Oct 2026). Existing users get nothing from these flows. Reaching existing users is a separate campaign later.

---

## 2. How it works

```
Signup confirmed ──▶ existing /api/hooks/email-confirmed ──▶ E1
Stripe webhook   ──▶ existing /api/stripe/webhook ───────▶ C5 (subscription created, existing code)
pg_cron, 15 min  ──▶ NEW /api/cron/lifecycle-email ──────▶ every other email
                       │
                       ├─ lifecycle_user_facts(start): one row of facts per user
                       ├─ pickEmail(facts, now): the ONE email due for this user, or none
                       └─ sendLifecycleEmail(): claim in email_sends ─▶ Resend ─▶ store resend_id
```

**Facts in SQL, rules in code.** The database function only gathers facts. Every timing, window, cap, priority and piece of copy lives in TypeScript config. Tuning or adding an email never needs a migration.

---

## 3. Anti-spam policy

All values live in `POLICY` in `src/lib/email/lifecycle/config.ts`.

| Rule | Value | Applies to |
|---|---|---|
| Minimum gap between any two emails to a user | 24h | Marketing emails. Transactional emails ignore it but still count as "last email sent". |
| Max per rolling 7 days | 4 | Marketing |
| Max unanswered: emails sent since the user's last activity | 4, then nothing until they're active again | Marketing |
| Send window, scheduled emails | 08:00–20:00 Europe/London | E2A, E3A, E2B, E3B, C2, C4, R1, R2 |
| Send window, R3 | 09:00–11:00 Europe/London | R3 |
| Immediate (no window) | — | E1, C1, C3, C5, C6 |
| On time or never | Every email has a due window. If it can't be sent inside it, it's dropped, never sent late. | All scheduled emails |
| Opt-out respected | `profiles.email_opt_out_at` set → no marketing | All except E1, C5 |
| Bounces and complaints | Resend's account-level suppression list | All |
| Only new signups | `signup_at >= POLICY.startDate` | All |

**Transactional:** E1, C5. **Marketing:** everything else.

**What this produces (checked against every path):**

| User | Emails | Marketing emails in the first 7 days |
|---|---|---|
| Never asks | E1 → E2A (24h) → E3A (72h) → stop | 2 |
| Asks once, never returns | E1 → E2B (24h after first question) → E3B (96h) → stop | 2 |
| Asks once, hits the limit, never returns | E1 → E2B (day 1) → E3B (day 4) → stop. E1 blocks C1 on signup day; C1 requires another capped day after the gap. | 2 |
| Comes back on a 2nd day | Flow 1 ends. Flow 2/3 on their own triggers. | ≤ 4 |
| Active, then silent 14 days | R1 on day 14–21 of silence, then nothing until active | 1 |

Never two emails on the same day. Never more than 4 marketing emails to someone who isn't responding.

---

## 4. Resend free plan

Limits: 100 emails/day and 3,000/month; API rate limit 2–10 requests/second depending on which Resend doc you read, so we plan for 2. ([quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits), [rate limit](https://resend.com/docs/api-reference/rate-limit))

| Setting | Value | Why |
|---|---|---|
| `POLICY.dailyBudget` | 60 sends per UTC day, counted from `email_sends` (all kinds) | Leaves at least 40/day for auth emails (password reset, and confirmations if Supabase SMTP goes through Resend) and the existing transactional sends. |
| Budget behaviour | When reached, marketing stops for the day. E1 and C5 still send. Due windows mean nothing is sent late the next day. | Transactional is never blocked. |
| `POLICY.maxPerRun` | 15 | One cron run never sends a burst. |
| Send pacing | Sequential, 600ms between sends | Stays under 2 req/s. |
| Idempotency | `idempotencyKey: "<user_id>:<dedupe_key>"` on every send | Resend drops a duplicate for 24h even if our claim logic fails. |
| Monthly | ≤ 60 × 30 = 1,800 | Under 3,000. |

Current volume: ~400 signups since launch, so expect 5–20 lifecycle sends a day. If the budget is hit regularly, upgrade to Resend Pro and raise `dailyBudget`.

---

## 5. Email catalogue

Priority: a lower number wins when several are due in the same run. Transactional emails don't go through the picker.

Hours are measured from the event named. "Free" = `profiles.tier = 'free'`. "Active day" = a `usage_limits` row with `query_count > 0`.

### Flow 1 — Activation

| ID | Prio | Due when | Window | Stop / limit | dedupe_key |
|---|---|---|---|---|---|
| **E1** Welcome | — | Signup email confirmed | Immediate | Once | `e1` |
| **E2A** First-question nudge | 40 | No active day yet | 24–48h after signup | Once | `e2a` |
| **E3A** Last activation nudge | 41 | Still no active day | 72–120h after signup | Once | `e3a` |
| **E2B** Day-2 return | 42 | `active_days = 1` | 24–48h after first activity (keeps "Yesterday you asked" true) | Once | `e2b` (variant stored) |
| **E3B** Check your own broker | 43 | `active_days = 1` | 96–168h after first activity | Once | `e3b` |

Flow 1 is for free users only: its copy talks about free limits, and Pro users are onboarded by C5 + C4 instead. A user who gets E2A and then asks moves onto the E2B path automatically. `active_days >= 2` ends Flow 1.

### Flow 2 — Conversion

| ID | Prio | Due when | Window | Stop / limit | dedupe_key |
|---|---|---|---|---|---|
| **C3** Limit reached again | 10 | Free, hit 5/5 today, C2 already sent | Immediate, today only | 14 days between, max 2 ever | `c3:<YYYY-MM-DD>` |
| **C1** Daily limit reached | 20 | Free, hit 5/5 today | Immediate, today only | Once | `c1` |
| **C6** Abandoned checkout | 30 | Free, checkout started and not completed | 1–24h after checkout `updated_at` | 14 days between | `c6:<YYYY-MM-DD>` |
| **C2** What Pro adds | 50 | Free, C1 sent | 48–120h after C1 | Once | `c2` |
| **C4** Pro day-3 check-in | 55 | `tier = 'pro'`, `pro_since` set | 72–168h after `pro_since` | Once ever | `c4` |
| **C5** Welcome to Pro | — | Subscription created with Pro access (incl. trialing) | Immediate | Once per subscription | `c5:<stripe_subscription_id>` |

C1, C2, C3, C6 never go to Pro users (`tier = 'pro'`, which also covers manually granted Pro). C4 only goes to Pro users.

### Flow 3 — Retention

| ID | Prio | Due when | Window | Stop / limit | dedupe_key |
|---|---|---|---|---|---|
| **R2** Review request | 60 | `active_days >= 3` | Within 72h of the 3rd active day's first activity | Once ever | `r2` |
| **R1** Gone quiet | 70 | `active_days >= 2` | 14–21 days after last activity | 60 days between | `r1:<YYYY-MM-DD>` |
| **R3** Referral | 80 | Pro for 30+ days, or `active_days >= 5` | 09:00–11:00 UK | Once ever | `r3` |

### Copy and links

The final copy and HTML for every email are in the demo artifact. Port them as-is, replacing sample values with variables:

| ID | Subject | Button → | Secondary link → |
|---|---|---|---|
| E1 | Your first check is 10 seconds away | Open Ask → `/ask` | — |
| E2A | Not sure what to ask? Tap one. | Ask now → `/ask` (+ 3 question links → `/ask?prefill=…`) | Or browse broker records first → `/compare/brokers` |
| E3A | One question. That's all it takes. | Ask now → `/ask` | Position size calculator → `/tools/position-size-calculator` |
| E2B | Yesterday you asked about {{topic_label}} | Continue in Ask → `/ask?prefill={{suggested_q}}` | per topic (below) |
| E3B | Do you know who's holding your money? | Check my broker → `/compare/brokers` | How to check if a broker is FCA regulated → `/blog/how-to-check-if-a-broker-is-fca-regulated` |
| C1 | You've used all 5 for today | See Pro plans → `/pricing` | What's in Intelligence → `/intelligence` |
| C2 | What you'd get with Pro | See Pro plans → `/pricing` (+ 4 feature links) | — |
| C3 | Capped again today | Go Pro → `/billing?plan=monthly` | Compare plans → `/pricing` |
| C4 | Three days on Pro. Here's what to set up. | Open Intelligence → `/intelligence` (+ Economic calendar and Journal links) | Manage billing → `/billing` |
| C5 | You're on Pro | Open Intelligence → `/intelligence` (+ 4 feature links, App Store + Google Play badges) | Manage billing → `/billing` |
| C6 | Still thinking about Pro? | Finish upgrading → `/billing?plan={{plan}}` | Questions about Pro? Read the FAQ → `/faq` |
| R1 | Before your next trade | Open Ask → `/ask` (+ 3 question links) | — |
| R2 | Quick favour? | Rate us on the App Store → `STORE_URLS.apple?action=write-review` | On Android? Rate us on Google Play → `STORE_URLS.googlePlay` |
| R3 | Know traders who'd use this? | Become an affiliate → `/affiliates` | Read the affiliate terms → `/affiliate-terms` |

**C4 copy** (new; not in the demo):
- Subject: Three days on Pro. Here's what to set up.
- Preview: Two things worth doing this week.
- Headline: Get the most out of Pro.
- Body: "Hi {{first_name}}," / "You've had Pro for three days. Two things worth setting up this week:" / link list: "Economic calendar — turn on event alerts so big news never catches you mid-trade →" `/economic-calendar` · "Journal — log your next trade; Challenge Mode tracks prop firm rules for you →" `/journal` / "Your daily brief is waiting in Intelligence every morning."
- Button: Open Intelligence → `/intelligence` · Text link: Manage billing → `/billing`

All links verified live (HTTP 200) on 15 Oct 2026. Store URLs come from `STORE_URLS` in `src/lib/site-config.ts`, never hard-coded.

**Variables:**

| Variable | Source | Fallback |
|---|---|---|
| `first_name` | First word of `profiles.display_name` | `there` |
| `topic_label`, `suggested_q`, topic link | Topic classifier (below) | `other` branch |
| `days_since` (R1) | Days since last activity | — |
| `plan` (C6) | `billing_checkout_sessions.plan` | `monthly` |

**UTM on every verify.trading link:** `utm_source=email&utm_medium=lifecycle&utm_campaign=<id>`, plus the variant for E2B (e.g. `e2b_broker`).

**Footer (every email):** the disclaimer, Blog · Glossary · Why trust us · FAQ, "Verify Trading Limited · United Kingdom", Unsubscribe · Email preferences (both → the unsubscribe page).

**Plain text:** every email ships a text part, generated from the same data as the HTML.

### Topic classifier (E2B, C2)

Keyword match on the first question's text (earliest `chat_messages` row with `role = 'user'`). Case-insensitive, checked in this order, and the first match wins. No text (chats deleted) → `other`.

| Order | Branch | Matches | topic_label | Suggested next question | Secondary link |
|---|---|---|---|---|---|
| 2 | propfirm | prop firm, ftmo, challenge, funded, evaluation, payout | prop firms | Which rules catch traders out at the firm you're looking at? | `/blog/prop-firm-challenge-rules-that-catch-traders-out` |
| 3 | broker | broker, regulated, regulation, fca, licence, license, scam, legit, safe, withdraw, deposit | your broker | Compare it with another broker you're considering. | `/blog/how-to-tell-a-scam-broker-from-a-real-one` |
| 4 | risk | risk, lot size, position size, sizing, stop loss, leverage, margin, drawdown | risk | How much should I risk per trade on my account size? | `/tools/position-size-calculator` |
| 5 | psychology | revenge, tilt, emotion, fomo, discipline, psychology, losing streak, overtrading | trading psychology | How do I stop after two losses in a row? | `/blog/revenge-trading-and-tilt-how-to-stop` |
| 6 | market | gold, xau, eur, gbp, usd, jpy, nas, us30, btc, oil, news, cpi, nfp, fed, forex, market | the markets | What's on the economic calendar this week, and why does it matter? | `/blog/how-to-trade-around-economic-news` |
| 7 | other | anything else | trading | Is the broker I trade with properly regulated? | `/compare/brokers` |

Match whole words, so "fed" doesn't match "fedex" and "safe" doesn't match "unsafe". Plurals count ("brokers", "payouts"), and currency pairs match as two codes with an optional slash ("eurusd", "eur/usd"). There is no chart-upload prompt in the app today, so no special chart branch. Check the classifier against 20 real first questions before launch.

**C2 feature order by topic:** market → Intelligence first; propfirm → Journal first; psychology → Mind first; otherwise Intelligence, Economic calendar, Journal, Mind.

---

## 6. Data model and recovery migration

`supabase/migration_35_lifecycle_email.sql`, followed by `supabase/migrations/20261026153725_lifecycle_email_recovery.sql`. Both are safe to re-run. Apply both before deploying the recovery code. The second migration adds persisted payloads and five-minute send leases, confirmed-recipient filtering, E1 history, and the pending Pro welcome query. Existing rows remain `sent` because their original payload cannot be recovered safely.

```sql
-- 1. Send log: idempotency, caps, history
create table if not exists public.email_sends (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  email_id    text not null,            -- 'e2a', 'c3', 'r1', ...
  dedupe_key  text not null,            -- 'e2a', 'c3:2026-10-15', 'c5:sub_123'
  kind        text not null check (kind in ('transactional', 'marketing')),
  variant     text,                     -- E2B topic branch, for reporting
  resend_id   text,
  sent_at     timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index if not exists email_sends_user_sent_idx on public.email_sends (user_id, sent_at desc);
create index if not exists email_sends_sent_idx on public.email_sends (sent_at);
alter table public.email_sends enable row level security;   -- no policies: service role only

-- 2. Marketing opt-out (null = subscribed)
alter table public.profiles add column if not exists email_opt_out_at timestamptz;

-- 3. Facts per user (rules live in TypeScript)
create or replace function public.lifecycle_user_facts(p_since timestamptz)
returns table (...)              -- columns below
language sql stable security definer set search_path = public, auth as $$ ... $$;
revoke all on function public.lifecycle_user_facts(timestamptz) from public, anon, authenticated;

-- 4. Schedule
select cron.schedule('lifecycle-email', '*/15 * * * *',
  $$select public.call_cron_endpoint('/api/cron/lifecycle-email')$$);
```

**Why a function, not a view:** a view in `public` is exposed through the Supabase API and would leak email addresses. Only the service role can execute the function.

**`lifecycle_user_facts` columns** (users with `profiles.created_at >= p_since` and a confirmed email address):

| Column | Source |
|---|---|
| `user_id`, `email` | `auth.users` |
| `display_name`, `tier`, `signup_at`, `email_opt_out_at` | `profiles` |
| `first_active_at` | `min(usage_limits.created_at)` where `query_count > 0` |
| `last_active_at` | `max(usage_limits.updated_at)` where `query_count > 0` |
| `active_days` | `count(*)` from `usage_limits` where `query_count > 0` |
| `third_active_at` | `created_at` of the 3rd active day, ordered by `usage_date` |
| `capped_today` | today's (UTC) `usage_limits.query_count >= 5` |
| `first_question` | content of the earliest `chat_messages` row with `role = 'user'` across the user's `chat_sessions` (nullable) |
| `pro_since` | `billing_subscriptions.created_at` where status is `active`, `trialing` or `past_due` |
| `checkout_started_at`, `checkout_plan` | `billing_checkout_sessions.updated_at`, `plan` where `completed_at is null` |
| `sends` | Completed or blocked `email_sends`, plus synthetic transactional E1 from `profiles.signup_welcome_email_sent_at`. Pending sends remain eligible for picker recovery. |

Pro users' questions also count in `usage_limits` (limit 20), so `capped_today` only matters together with `tier = 'free'`.

---

## 7. Code layout

```
src/lib/email/lifecycle/
  config.ts       POLICY + EMAILS (id, kind, priority, enabled, window, due(), dedupeKey(), vars?(), variant?())
  pick.ts         pickEmail(facts, now) — pure function, no I/O
  topic.ts        classifyTopic(text) + firstNameFrom(name)
  emails.ts       copy for the 15 emails → { subject, sender, html, text }
  send.ts         sendLifecycleEmail(): lease + frozen payload → Resend → record / retry
  unsubscribe.ts  token sign/verify (HMAC-SHA256 of user_id)
src/app/api/cron/lifecycle-email/route.ts
src/app/api/email/unsubscribe/route.ts
tests/lib/email/lifecycle-pick.test.ts
```

### `config.ts` shape

```ts
export const POLICY = {
  minHoursBetween: 24,
  maxPer7Days: 4,
  maxUnanswered: 4,
  sendWindowUk: [8, 20],
  dailyBudget: 60,
  maxPerRun: 15,
  sendGapMs: 600,
} as const;

// One entry per email. To pause one: enabled: false. To retime one: edit its numbers.
{ id: "e2a", kind: "marketing", priority: 40, enabled: true,
  window: "scheduled",
  due: (f, now) => f.activeDays === 0 && between(hoursSince(f.signupAt, now), 24, 48) }
```

### `pickEmail(facts, now)`

1. Skip the user if they opted out, or if the mode is `test` and the email isn't on the allowlist.
2. Gate on the global caps: last send < 24h ago → none. Marketing sends in the last 7 days ≥ 4 → none. Marketing sends after `last_active_at` (or after signup, if never active) ≥ 4 → none.
3. Walk enabled marketing emails in priority order. Return the first that is `due()`, inside its send window, not blocked by its own once / cooldown / max-ever rule, and not blocked by the Pro rule.
4. Return `{ emailId, dedupeKey, vars }` or `null`.

Pure function: all the logic is unit-testable without a database.

### `sendLifecycleEmail({ userId, email, emailId, dedupeKey, kind, variant, vars })`

1. **Render** from `emails.ts` with UTMs and the signed unsubscribe URL.
2. **Claim:** `claim_lifecycle_email` persists the first payload and takes a five-minute lease. Completed rows return `duplicate`; live leases and changed recipient eligibility return `skipped`. A stale lease can be reclaimed. The claim rechecks confirmation, opt-out, tier exclusions, and the 24-hour gap. An unresolved send prevents a different email from bypassing the gap.
3. **Send** with `resend.emails.send(payload, { idempotencyKey: \`${userId}:${dedupeKey}\` })`, including headers:
   - `List-Unsubscribe: <https://www.verify.trading/api/email/unsubscribe?u=…&t=…>`
   - `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
   - `from`: `getSignupEmailFromAddress()` for Flow 1 + 3 and C1–C3, C6; `getSubscriptionEmailFromAddress()` for C4
4. **Success:** store `status = sent`, `resend_id`, and the send time. **Failure:** retain the payload, release the lease, and retry only while the email remains due. A failed success write is also replayed safely; C5 is not stamped until its send log is repaired. Every replay uses the original payload and key. Definitively rejected first attempts can reset the retry window; ambiguous attempts stop after 23 hours as `blocked`, before Resend expires the key at 24 hours. Check blocked rows in the Resend dashboard before resolving them. They are never blindly resent.

### Cron route `GET /api/cron/lifecycle-email`

- `requireCronSecret`, `export const maxDuration = 60`, `runtime = "nodejs"`.
- `LIFECYCLE_EMAIL_TEST_TO` set → test mode (allowlist only); otherwise live.
- First retry missing Pro welcomes from `billing_subscriptions` created since `POLICY.startDate`, including failed subscription stamps. These are transactional and ignore the marketing budget and test allowlist.
- Count today's completed, in-flight, blocked, or ambiguous sends. Definitively rejected attempts do not consume the budget. If at or over `dailyBudget`, stop marketing.
- `rpc("lifecycle_user_facts", { p_since: POLICY.startDate })`, `pickEmail` for each user, sort picks by priority, take up to `min(maxPerRun - welcomeRetries, budget left)`, send sequentially with `sendGapMs`.
- Return `{ welcomeRetries, considered, picked, sent, failed }` for logs. `welcomeRetries` counts attempted welcome recoveries; the other send tallies describe marketing.

### Unsubscribe `GET|POST /api/email/unsubscribe?u=<user_id>&t=<hmac>`

- **POST** (one-click from the mail client's header): verify the token, set `email_opt_out_at = now()`, return 200. No login.
- **GET** (footer link): verify the token, show a small page with an "Unsubscribe" button that POSTs. GET never unsubscribes on its own, because email link scanners prefetch GET links. If the user is already unsubscribed, the page offers "Resubscribe" (sets the column back to null). "Email preferences" links to the same page.
- Bad or missing token → 400, and change nothing.

---

## 8. Changes to existing code

| File | Change |
|---|---|
| `src/lib/email/send-signup-welcome.ts` | No change. E1 is the existing welcome. |
| `maybe-send-subscription-welcome.ts` (old `send-subscription-welcome.ts` deleted) | C5 now sends through `sendLifecycleEmail` (new design, logged as `c5:<sub_id>`); the unique `email_sends` claim is the only dedupe. Same trigger. An already-set `welcome_email_sent_at` skips the send (protects older subscriptions); it is stamped after `sent` or a completed `duplicate` result. An active lease returns `skipped`. The cron retries missing welcomes independently of webhook redelivery. Not affected by test mode. If `CRON_SECRET` is missing it still sends, without the unsubscribe header. |
| `src/lib/email/templates.ts` | Extend the existing layout: bullet list, link list, secondary text link, the standard footer with the unsubscribe URL. |
| `src/app/signup/signup-page-content.tsx` | One line under the form: "We'll send a few emails to help you get started. Unsubscribe any time." + privacy link. Needed for the UK PECR soft opt-in. |
| `src/components/ask/ask-chat-helpers.ts:18` | "Gold: key levels before London open" → "Gold: what's driving it before London open" (VT-AIG-003). |
| `src/components/markets/twelve-markets-page.tsx:138` | → `Brief me on ${assetName}: what's driving it today and what events are coming up?` (VT-AIG-003). |
| `src/components/ask/ask-empty-state.tsx:82` | Remove "projections" from the subtitle (VT-AIG-003). |
| `.env.example`, `README.md` | Document the new env vars. |
| `docs/email-flows-v2-simplified.md` | Delete (replaced by this spec). |

Out of scope: the chart-analysis card that renders entry/stop/target levels (`src/components/ask/cards.tsx`). That's AI output, not a prompt string. It goes in a separate VT-AIG-003 ticket.

---

## 9. Configuration

| Env var (Vercel) | Value | Notes |
|---|---|---|
| `LIFECYCLE_EMAIL_TEST_TO` | comma-separated emails | **The only lifecycle env var, optional.** While set, only these addresses receive anything (test mode, or a pause). Unset = live. |

The go-live date is not an env var: it is `POLICY.startDate` (config.ts, 15 Oct 2026). Only users who signed up on/after it are ever emailed. **Deploying with `LIFECYCLE_EMAIL_TEST_TO` unset means live**, so set it before the first deploy if you want to test first.
| Existing: `RESEND_API_KEY`, `EMAIL_FROM_SIGNUP`, `EMAIL_FROM_SUBSCRIPTION`, `CRON_SECRET` | — | Already set. `CRON_SECRET` also signs unsubscribe links (HMAC over `"unsubscribe:" + user_id`), so rotating it invalidates unsubscribe links in emails already sent. |

Manual steps outside the code:
- **Supabase:** apply migration 35, then the recovery migration listed in §6 before deploying the recovery code. The Vault secrets `app_base_url` and `cron_secret` already exist (the markets cron uses them).

---

## 10. Tests

`tests/lib/email/lifecycle-pick.test.ts`, one test per rule. Each failing test means a user gets spammed or misses an email:

- each path in the §3 table produces exactly the listed emails at the listed times
- 24h gap, 4-per-7-days and 4-unanswered caps block as expected
- due windows: E2A at 49h → nothing (dropped, not late)
- send window: E2A due at 22:00 UK → waits until 08:00, still inside the 24–48h window
- Pro user never gets C1/C2/C3/C6; opted-out user gets nothing from the picker
- C3: 14-day gap and max 2 ever
- `classifyTopic`: one case per branch, plus "unsafe" ≠ broker and "fedex" ≠ market

Plus a route test for `/api/cron/lifecycle-email` (auth, `off` mode, budget), following `tests/app/api/cron/markets-route.test.ts`.

---

## 11. Rollout

1. **Build** (sections 6–8) → `npm test`, `npm run build`, `npm run lint`. Set `LIFECYCLE_EMAIL_TEST_TO` in Vercel **before** deploying, so the first deploy is in test mode.
2. **Migration:** apply migration 35 and the recovery migration in the Supabase SQL editor before deployment. Cron starts calling the deployed route. Marketing is live unless `LIFECYCLE_EMAIL_TEST_TO` contains an allowlist; there is no `off` mode.
3. **Test mode:** with `LIFECYCLE_EMAIL_TEST_TO` set to the test addresses, sign up fresh test accounts with those addresses:
   - never ask
   - ask once
   - come back on day 2
   - hit 5/5
   - start checkout without paying
   - become Pro (C5 immediately, C4 three days later)

   Check each email in Gmail, Outlook and Apple Mail (iPhone): layout, links, UTMs, the unsubscribe page, and the `List-Unsubscribe` header in the raw source. Run the topic classifier against 20 real first questions.
4. **Live:** remove `LIFECYCLE_EMAIL_TEST_TO`. Real users who signed up since the start date now get their due emails; due windows mean nobody gets anything late or out of order.
5. **First week:** check the Resend dashboard daily for bounces and complaints. Spot-check that nobody got two emails in 24h:
   ```sql
   select user_id from email_sends a join email_sends b using (user_id)
   where a.id <> b.id and b.sent_at between a.sent_at and a.sent_at + interval '24 hours'
     and a.kind = 'marketing' and b.kind = 'marketing';
   ```
6. **After 4 weeks:** review per email: sent, and the user did the goal within 48h (asked, returned, upgraded). Use `email_sends` joined to `usage_limits` and `billing_subscriptions`.

## 12. Later (not in v1)

E1 welcome video (and new E1 copy) · trial-ending email · app-usage signal for R2 · `signup_platform` · `email_events` + Resend webhook for click reporting · a campaign for existing users (including the 88 who've hit the limit) · win-back after cancellation · VT-AIG-003 chart card.
