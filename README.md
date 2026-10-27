# verify.trading (Next.js).

Ask interface for traders: broker checks, briefings, calculators, chart analysis, and projections. Stack: **Next.js 16**, **Supabase**, **OpenAI-compatible gateway** (AI SDK), **FMP**.

## Local development

```bash
npm install
cp .env.example .env.local
```

Fill in at least `OPENAI_BASE_URL` and `OPENAI_API_KEY`. Add Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and `FMP_API_KEY` when you need auth, persistence, and live markets. Add Stripe variables when you want subscription billing and the customer portal.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tests

```bash
npm test
npm run build
```

## Environment variables

See `.env.example` for all keys. Lifecycle email behavior is specified in `docs/lifecycle-emails-spec.md`. **Never commit `.env` or `.env.local`** (they are gitignored).

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_BASE_URL` | For Claude | Claude gateway base URL; falls back to `OPENAI_BASE_URL` |
| `ANTHROPIC_API_KEY` | Yes (for Claude) | Claude gateway key, separate from the GPT key |
| `OPENAI_BASE_URL` | For GPT overrides | GPT gateway base URL (pikachu.hueling.cc) |
| `OPENAI_API_KEY` | For GPT overrides | GPT gateway API key |
| `ASK_MODEL` | Optional | Ask model (default `claude-sonnet-5-5`) |
| `ASK_SIMPLE_MODEL` | Optional | Journal/challenge writer model (default `claude-sonnet-5-5`) |
| `ASK_COACH_MODEL` | Optional | Mind coach model (default `claude-sonnet-5-5`) |
| `NEXT_PUBLIC_SUPABASE_URL` | For Auth + chat history | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For Auth (browser + SSR) | Anon key (safe to expose) |
| `SUPABASE_SERVICE_ROLE_KEY` | For chat history + admin tasks | Service role (server only) |
| `STRIPE_SECRET_KEY` | For billing | Server-side Stripe API access |
| `STRIPE_WEBHOOK_SECRET` | For billing | Verifies Stripe webhook signatures |
| `STRIPE_PRICE_PRO_WEEKLY` | For billing | Weekly recurring price ID (£6.99/week) |
| `STRIPE_PRICE_PRO_MONTHLY` | For billing | Monthly recurring price ID (£19.99/month) |
| `STRIPE_PRICE_PRO_MONTHLY_STANDARD` | Optional fallback | Legacy monthly price env name during rollout |
| `STRIPE_PRICE_PRO_ANNUAL` | For annual billing | Yearly recurring price ID (£119.99/year) |
| `STRIPE_PORTAL_CONFIGURATION_ID` | Optional | Stripe customer portal configuration |
| `RESEND_API_KEY` | For welcome emails | Resend transactional email API key |
| `EMAIL_FROM_SIGNUP` | For signup welcome | Default `verify.trading <ai@verify.trading>` |
| `EMAIL_FROM_SUBSCRIPTION` | For Pro welcome | Default `verify.trading <pro@verify.trading>` |
| `LIFECYCLE_EMAIL_TEST_TO` | No | Test mode / pause: only these comma-separated emails get lifecycle mail. Unset = live for signups after `POLICY.startDate` |
| `FMP_API_KEY` | For live market tools | Financial Modeling Prep |
| `NEXT_PUBLIC_APP_NAME` | No | Product name in UI + system prompt (default `verify.trading`) |
| `NEXT_PUBLIC_SITE_TITLE` | No | `<title>` override |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | No | Meta description |

## Deploy on Vercel + GitHub

1. **Push this repo to GitHub** (new repo or existing `origin`).
2. In [Vercel](https://vercel.com) → **Add New Project** → **Import** the repository.
3. **Framework Preset:** Next.js (auto-detected). **Build Command:** `npm run build`, **Output:** default.
4. **Environment Variables:** copy from `.env.example` and set production values. Add every `NEXT_PUBLIC_*` and server secret Vercel should inject at build/runtime (`ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc.).
5. **Deploy.** After the first deploy, configure Supabase **Auth**: Site URL, redirect URLs (`http://localhost:3000/**`, `https://<project>.vercel.app/**`), and OAuth providers (e.g. Google). Run SQL migrations in order through the latest `supabase/migration_*.sql` file.

### Custom domain

In Vercel → Project → **Domains**, attach your domain. Set the same env vars for **Preview** if you want PR previews to hit real APIs (use caution with production keys).

### Markets cache cron

Markets data is refreshed by Supabase Cron, not Vercel Cron. This avoids Vercel Hobby's once-per-day cron limit while keeping the existing Next.js refresh route.

1. Set `CRON_SECRET` in Vercel.
2. Store the production base URL and matching cron secret in Supabase Vault:

```sql
select vault.create_secret('https://your-production-domain.com', 'markets_cron_base_url');
select vault.create_secret('same-value-as-CRON_SECRET', 'markets_cron_secret');
```

3. Run database migrations. `database/migrations/20260508_supabase_markets_cron.sql` schedules `refresh-market-cache` every 5 minutes and calls `/api/cron/markets` with the bearer token.

The cron route writes the latest run summary to `market_cache` under `cron:markets:last-run`:

```sql
select fetched_at, payload
from market_cache
where cache_key = 'cron:markets:last-run';
```

### Lifecycle email rollout

Apply `supabase/migration_35_lifecycle_email.sql`, then `supabase/migrations/20261026153725_lifecycle_email_recovery.sql` in the Supabase SQL editor **before deploying the recovery code**. These scripts are safe to re-run. This repository's older SQL scripts are applied manually; the new migration file alone is not a complete CLI migration baseline.

Marketing requires a confirmed address and observes a 24-hour gap after the signup welcome. Failed Pro welcomes retry from the 15-minute lifecycle cron, independently of the marketing budget and test allowlist. Interrupted sends reuse the saved payload and idempotency key after a five-minute lease expires.

Ambiguous attempts stop after 23 hours, before Resend's 24-hour idempotency window expires. Check `email_sends` rows with `status = 'blocked'` in the Resend dashboard before reconciling them; existing pre-migration rows are preserved as sent to avoid unsafe replays. Definitively rejected first attempts (for example, HTTP 429) remain retryable. Full behavior and rollout checks are in [the lifecycle spec](docs/lifecycle-emails-spec.md).

Database regression checks: `psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/sql/lifecycle-email-recovery.sql` against a test database with both migrations applied. The checks roll back their fixtures.

### Fresh branding (no client-specific origins in code)

Deployment host and product copy are driven by env vars (`NEXT_PUBLIC_APP_NAME`, optional title/description). There is no hardcoded client origin list in this app; configure CORS or Supabase URL allowlists in those services if needed.

## Shareable monthly trial link

Share `https://www.verify.trading/?offer=monthly-14-day` after deploying this change. New subscribers sign up (or sign in to an existing free account), then enter a card in Stripe Checkout to start 14 days of Pro free. After the trial, the existing Pro Monthly plan renews at £19.99/month until canceled. Customers with a previous subscription cannot claim another trial. No coupon code or new Stripe price is needed.

The existing Tubman referral link continues to use its separate offer and referral attribution.

## Security notes

- **Secrets:** Keep `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and market API keys **server-only** (never `NEXT_PUBLIC_*` except Supabase URL + anon if you add them later). Rotate keys if exposed.
- **Protected routes:** `/ask` and `/markets` require a signed-in session (middleware redirects to `/login?next=…`). **Auth pages:** logged-in users hitting `/login` or `/signup` are redirected to `/ask`.
- **Ask API:** `POST /api/ask` and related `/api/ask/*` routes require a **signed-in Supabase user** (cookie session). **Free** users are limited to **5 Ask queries per UTC day** (see `migration_12.sql`); **Pro** tier has no daily cap, and Stripe billing now keeps `profiles.tier` in sync.
- **Billing:** Stripe checkout starts at `POST /api/stripe/checkout`, webhook events arrive at `POST /api/stripe/webhook`, the customer portal starts at `POST /api/stripe/customer-portal`, successful checkouts can be reconciled immediately via `POST /api/stripe/sync-checkout`, and in-app cancel/resume actions go through `POST /api/stripe/subscription`.
- **Markets API:** `GET /api/markets` requires a signed-in user.
- **Sessions:** Chat rows are tied to `auth.users` via `chat_sessions.user_id`. Storage paths for attachments use `{userId}/{sessionId}/…` to match storage RLS.
- **Uploads:** Images are validated as PNG/JPEG/WebP data URLs and capped at **5MB** server-side (`ASK_ATTACHMENT_MAX_BYTES`). The JSON body also caps the `image` field length.
- **Dependency audit:** Run `npm audit` periodically; current report: **0** known vulnerabilities.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run seed:verified-entities` | Sync verified entities CSV → Supabase (needs Supabase env) |
| `npm run eval:ask` | Run Ask evals against `ASK_EVAL_BASE_URL` |
