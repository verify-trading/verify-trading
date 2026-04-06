# verify.trading (Next.js)

Ask interface for traders: broker checks, briefings, calculators, chart analysis, and projections. Stack: **Next.js 16**, **Supabase**, **Anthropic** (AI SDK), **Twelve Data**.

## Local development

```bash
npm install
cp .env.example .env.local
```

Fill in at least `ANTHROPIC_API_KEY`. Add Supabase and `TWELVE_DATA_API_KEY` when you need persistence and live markets.

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
| `NEXT_PUBLIC_SUPABASE_URL` | For chat history | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | For chat history | Service role (server only) |
| `TWELVE_DATA_API_KEY` | For live market tools | Twelve Data API |
| `NEXT_PUBLIC_APP_NAME` | No | Product name in UI + system prompt (default `verify.trading`) |
| `NEXT_PUBLIC_SITE_TITLE` | No | `<title>` override |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | No | Meta description |

## Deploy on Vercel + GitHub

1. **Push this repo to GitHub** (new repo or existing `origin`).
2. In [Vercel](https://vercel.com) → **Add New Project** → **Import** the repository.
3. **Framework Preset:** Next.js (auto-detected). **Build Command:** `npm run build`, **Output:** default.
4. **Environment Variables:** copy from `.env.example` and set production values. Add every `NEXT_PUBLIC_*` and server secret Vercel should inject at build/runtime (`ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc.).
5. **Deploy.** After the first deploy, update Supabase **Auth URL settings** or any allowlists if you use them, to include your `https://<project>.vercel.app` domain.

### Custom domain

In Vercel → Project → **Domains**, attach your domain. Set the same env vars for **Preview** if you want PR previews to hit real APIs (use caution with production keys).

### Fresh branding (no client-specific origins in code)

Deployment host and product copy are driven by env vars (`NEXT_PUBLIC_APP_NAME`, optional title/description). There is no hardcoded client origin list in this app; configure CORS or Supabase URL allowlists in those services if needed.

## Security notes

- **Secrets:** Keep `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and market API keys **server-only** (never `NEXT_PUBLIC_*` except Supabase URL + anon if you add them later). Rotate keys if exposed.
- **Ask API:** `POST /api/ask` and related routes are **unauthenticated** by design in this repo—anyone who can reach your deployment can call them (cost + abuse risk). For production, add **Vercel Authentication**, **IP allowlists**, **API keys** (header check in route handlers), or **Upstash rate limiting** before wide release.
- **Sessions:** Chat sessions are scoped by **UUID** only. If you need multi-user isolation, add **Supabase Auth** (or similar) and enforce `user_id` on every row + RLS policies in Supabase.
- **Uploads:** Images are validated as PNG/JPEG/WebP data URLs and capped at **5MB** server-side (`ASK_ATTACHMENT_MAX_BYTES`). The JSON body also caps the `image` field length.
- **Dependency audit:** Run `npm audit` periodically; current report: **0** known vulnerabilities.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run seed:verified-entities` | Sync verified entities CSV → Supabase (needs Supabase env) |
| `npm run eval:ask` | Run Ask evals against `ASK_EVAL_BASE_URL` |
