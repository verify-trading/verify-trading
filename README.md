# verify.trading (Next.js)

Ask interface for traders: broker checks, briefings, calculators, chart analysis, and projections. Stack: **Next.js 16**, **Supabase**, **Anthropic** (AI SDK), **FMP**.

## Local development

```bash
npm install
cp .env.example .env.local
```

Fill in at least `ANTHROPIC_API_KEY`. Add Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and `FMP_API_KEY` when you need auth, persistence, and live markets.

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

See `.env.example` for all keys. **Never commit `.env` or `.env.local`** (they are gitignored).

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Yes (for Ask) | Claude API key |
| `NEXT_PUBLIC_SUPABASE_URL` | For Auth + chat history | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For Auth (browser + SSR) | Anon key (safe to expose) |
| `SUPABASE_SERVICE_ROLE_KEY` | For chat history + admin tasks | Service role (server only) |
| `FMP_API_KEY` | For live market tools | Financial Modeling Prep |
| `NEXT_PUBLIC_APP_NAME` | No | Product name in UI + system prompt (default `verify.trading`) |
| `NEXT_PUBLIC_SITE_TITLE` | No | `<title>` override |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | No | Meta description |

## Deploy on Vercel + GitHub

1. **Push this repo to GitHub** (new repo or existing `origin`).
2. In [Vercel](https://vercel.com) → **Add New Project** → **Import** the repository.
3. **Framework Preset:** Next.js (auto-detected). **Build Command:** `npm run build`, **Output:** default.
4. **Environment Variables:** copy from `.env.example` and set production values. Add every `NEXT_PUBLIC_*` and server secret Vercel should inject at build/runtime (`ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc.).
5. **Deploy.** After the first deploy, configure Supabase **Auth**: Site URL, redirect URLs (`http://localhost:3000/**`, `https://<project>.vercel.app/**`), and OAuth providers (e.g. Google). Run SQL migrations in order: `supabase/migration_1.sql`, `migration_2.sql`, `migration_3.sql`, `migration_4.sql`.

### Custom domain

In Vercel → Project → **Domains**, attach your domain. Set the same env vars for **Preview** if you want PR previews to hit real APIs (use caution with production keys).

### Fresh branding (no client-specific origins in code)

Deployment host and product copy are driven by env vars (`NEXT_PUBLIC_APP_NAME`, optional title/description). There is no hardcoded client origin list in this app; configure CORS or Supabase URL allowlists in those services if needed.

## Security notes

- **Secrets:** Keep `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and market API keys **server-only** (never `NEXT_PUBLIC_*` except Supabase URL + anon if you add them later). Rotate keys if exposed.
- **Protected routes:** `/ask` and `/markets` require a signed-in session (middleware redirects to `/login?next=…`). **Auth pages:** logged-in users hitting `/login` or `/signup` are redirected to `/ask`.
- **Ask API:** `POST /api/ask` and related `/api/ask/*` routes require a **signed-in Supabase user** (cookie session). **Free** users are limited to **20 Ask queries per UTC day** (see `reserve_ask_query` in `migration_3.sql`); **Pro** tier has no daily cap (set `profiles.tier = 'pro'` in the database until Stripe is wired).
- **Markets API:** `GET /api/markets` requires a signed-in user.
- **Sessions:** Chat rows are tied to `auth.users` via `chat_sessions.user_id`. Storage paths for attachments use `{userId}/{sessionId}/…` to match storage RLS.
- **Uploads:** Images are validated as PNG/JPEG/WebP data URLs and capped at **5MB** server-side (`ASK_ATTACHMENT_MAX_BYTES`). The JSON body also caps the `image` field length.
- **Dependency audit:** Run `npm audit` periodically; current report: **0** known vulnerabilities.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run seed:verified-entities` | Sync verified entities CSV → Supabase (needs Supabase env) |
| `npm run eval:ask` | Run Ask evals against `ASK_EVAL_BASE_URL` |
