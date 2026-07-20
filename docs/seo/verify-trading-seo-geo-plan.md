# Verify Trading — SEO / GEO Remediation Plan

**Prepared for:** the dev side (us). **Source audit:** *1.0 Verify Trading SEO Audit* (Novalab SEO Agency).
**Stack verified:** Next.js 16.2.2 · React 19 · App Router · TypeScript · SSR on Vercel · Supabase.
**Canonical host:** `https://www.verify.trading` (apex 307-redirects to www — see Phase 2).

This plan separates **what we build (code)** from **what the SEO agency does (off-page/content)**, reality-checks the audit against the actual codebase, folds in current (2026) GEO/AI-search research, and lays out a phased implementation.

> **Status — 2026-07-08:** Phases 0–3 (metadata foundation, JSON-LD schema, crawl hygiene, mobile-LCP RSC refactor) are **implemented, cleaned up with two `/simplify` passes, and verified via `next build` + a runtime smoke test** — `robots.txt` (AI crawlers + host + sitemap), `sitemap.xml` (11 public URLs), homepage title/canonical/4× JSON-LD/per-page OG, gated-page redirects, and the generated OG image are all confirmed. Still pending: the apex→www **308** flip (Vercel dashboard, not code) and **Phase 4** (content pipeline / articles), which was intentionally deferred.

---

## Part 1 — Who owns what

The audit mixes three kinds of work. Only the first column is ours.

| Owner | Scope |
|---|---|
| **US (dev/code)** | Technical SEO: canonicals, `metadataBase`, title templates, OG/Twitter tags, JSON-LD schema, `robots.ts`/`sitemap.ts`, crawlability/redirects, mobile performance (LCP), semantic markup, the publishing pipeline for content. |
| **SEO AGENCY (Novalab)** | **Backlinks / link-building / digital PR** ✅ (your assumption is correct), keyword research, content strategy & topic selection, writing the article/landing copy, outreach, directory submissions, guest posts. |
| **SHARED** | On-page content lives at the seam: *they* research keywords and write copy; *we* build the page templates, FAQ components, schema, and internal-linking structure that the copy drops into. |

### Audit findings → owner map

| # | Audit finding | Owner | Real on *this* site? |
|---|---|---|---|
| 1 | Homepage canonical missing | **Us** | ✅ Real — zero canonicals site-wide, no `metadataBase` |
| 2 | Schema markup missing | **Us** | ✅ Real — no JSON-LD anywhere |
| 3 | Duplicate meta descriptions | **Us** | ✅ Real — `/guide`, `/tools` (public) share the root default; `/ask`, `/markets` too |
| 4 | robots.txt too basic | **Us** | ⚠️ Partly — it works; improve structure + add AI-crawler rules |
| 5 | Mobile perf / LCP 7.8s | **Us** | ✅ Real — whole landing page is a client component (framer-motion) |
| 6 | Missing image alt text | **Us** | ❌ **Not real here** — `next/image` with real alt throughout |
| 7 | Uppercase URLs | **Us** | ❌ **Not real** — all routes are lowercase-hyphenated |
| 8 | URL parameters | **Us** | ❌ **Not real** — path-based routing, no param nav |
| 9 | Non-sequential H2 headings | **Us** | ❌ **Not real** — single `<h1>`, clean hierarchy |
| 10 | Internal 3xx redirects | **Us** | ⚠️ Partly — apex→www is 307 (should be 308); auth middleware redirects |
| 11 | Title == H1 | **Us** | ⚠️ Cosmetic — not a real ranking problem; ignore |
| 12 | No AI-search visibility (GEO) | **Shared** | ✅ Real — see Part 3 |
| 13 | Weak backlink profile (DR 1.1) | **SEO agency** | ✅ Real — **their job, not ours** |
| 14 | 0 organic keywords/traffic | **SEO agency** + shared | ✅ Real — needs keyword research + content |

> **Note for the agency conversation:** items 6–9 and 11 in the audit don't actually apply to this codebase — it's a partly-templated audit. The genuinely code-actionable items are **1, 2, 3, 4, 5, 10, and the technical half of 12**. Worth saying so we don't burn dev time "fixing" non-issues.

---

## Part 2 — GEO / AI search: what actually works in 2026

The audit says "no visibility in ChatGPT / Perplexity / AI Overviews / Gemini / Copilot / Grok" and recommends "better-structured content." Here's the research-grounded reality so we invest correctly:

**The myth to avoid:** there is no magic AI markup. Google's own [AI-features guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) is explicit:
> "Google Search ignores llms.txt files and other 'special' markup." Structured data is "not required for generative AI search." Chunking/rewriting-for-AI does nothing.

**What actually drives AI citations (Google + Princeton GEO study + industry consensus):**
1. **Be crawlable & indexable** — if a bot can't fetch it, it can't cite it. (Our `/ask`, `/markets` currently redirect bots to `/login` → invisible.)
2. **Good page experience, esp. mobile** — Google lists this for AI features directly. Our LCP fix (Phase 3) is a GEO fix too.
3. **Direct-answer content structure** — answer the question in the first 1–2 sentences, then expand. FAQ blocks, definitions, comparison tables.
4. **Unique, citable substance** — original data, stats, a named methodology. verify.trading's `/methodology` page and the FCA/broker-verification data are genuine citation bait; lean into it.
5. **Authority / brand mentions across the web** — this is the **agency's** backlink + digital-PR work. LLMs cite sources they "see" mentioned often.
6. **Be eligible for the citation crawlers** — allow `OAI-SearchBot`, `PerplexityBot`, `Claude-SearchBot`, `Google-Extended` (Phase 2).
7. **FAQPage schema** — Google says "not required," but independent data shows FAQ-schema pages are ~2.3× more likely to surface in AI Overviews, and it gives every engine clean entity extraction. Cheap, do it.

**Bottom line:** *GEO ≈ solid technical SEO + structured/answer-first content + off-page authority.* Fixing this audit **is** the GEO foundation. `llms.txt` is optional and explicitly ignored by Google — we'll ship one anyway (10 min, some non-Google engines read it) but it is **not** a priority.

---

## Part 3 — Our implementation plan (phased)

Effort assumes one dev familiar with the codebase. File paths are real.

### Phase 0 — Metadata foundation (½–1 day) 🔴 highest ROI
Create a single source of truth and wire canonicals/OG everywhere.

- [ ] Add `SITE_URL` constant to `src/lib/site-config.ts` (`https://www.verify.trading`); reuse it in `robots.ts` + `sitemap.ts` (kill the duplicated hardcoded base URL).
- [ ] Root `layout.tsx` metadata:
  - `metadataBase: new URL(SITE_URL)`
  - `title: { default: getSiteTitle(), template: "%s | verify.trading" }`
  - default `openGraph` (title, description, url, siteName, type, image) + `twitter` (`summary_large_image`).
  - `alternates: { canonical: "/" }` as a sane default.
- [ ] Add `opengraph-image.tsx` (or a static `/public/og.png`, 1200×630) so shares/AI cards have a preview. Optionally `app/opengraph-image` via `ImageResponse`.
- [ ] Per-page: add `alternates: { canonical: "/<route>" }` to every public page's `metadata` (relative — resolves via `metadataBase`).
- [ ] Fix titles that hardcode `| verify.trading` (`/affiliates`, `/auth/update-password`) so the new `template` doesn't double-suffix.
- [ ] Give `/guide` and `/tools` their own unique `title` + `description` (currently inheriting root default → duplicate-meta).

### Phase 1 — Structured data / JSON-LD (1–1.5 days)
Add a tiny schema layer. New files: `src/lib/seo/schema.ts` (typed builders) + `src/components/seo/json-ld.tsx` (`<script type="application/ld+json">`).

- [ ] **Organization** — name, url, logo, sameAs (social profiles), contact. Emit in root layout.
- [ ] **WebSite** — name + url (+ `potentialAction` SearchAction only if we expose a real search endpoint). Root layout.
- [ ] **SoftwareApplication** — the product is an app (download CTAs). `applicationCategory: FinanceApplication`, `operatingSystem`, `offers` (free + paid tiers from pricing). **No `aggregateRating` unless we have real reviews** — never fake it. On `/` and `/pricing`.
- [ ] **FAQPage** — the homepage already hand-builds a 4-Q&A FAQ (`landing-page.tsx` `FAQSection`); emit matching `FAQPage` JSON-LD from the same data. Highest GEO value.
- [ ] **BreadcrumbList** — add when we build content/blog hierarchy (Phase 4).
- [ ] Validate every type in Google Rich Results Test + schema.org validator before merge.

### Phase 2 — Crawlability, robots, sitemap, redirects (½–1 day)
- [ ] **Decision needed** (see Part 5): are `/ask`, `/markets`, `/guide`, `/tools` meant to be public/indexable? Reconcile three things that currently disagree — middleware (gates `/ask`,`/markets`→`/login`), `sitemap.ts` (lists `/ask`,`/markets`), and reality.
  - Public marketing/tool pages → ensure a crawlable (SSR, no auth-wall) version exists.
  - Truly gated pages → **remove from sitemap** and `disallow` in robots.
- [ ] Rewrite `sitemap.ts`: include the real public set (`/`, `/methodology`, `/pricing`, `/affiliates`, `/guide`?, `/tools`?, legal), drop gated ones, and stop recomputing `lastModified: new Date()` every request (use build time or per-page dates).
- [ ] Upgrade `robots.ts`: keep `disallow: /api/, /auth/`, and **add explicit AI-crawler allow rules** for `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `Perplexity-User`, `Claude-SearchBot`, `ClaudeBot`, `Google-Extended`. Add `host: SITE_URL`.
- [ ] **Apex→www redirect:** change from **307 → 308 (permanent)** in Vercel domain settings so Google consolidates link equity onto www. (No code — Vercel dashboard, but it's ours to flip.)

### Phase 3 — Mobile performance / LCP 7.8s → <2.5s (2–3 days)
Root cause is **not** images (there's no hero raster) — it's that the **entire landing page is one `"use client"` component** (`src/components/landing/landing-page.tsx`) with framer-motion in the critical path, so the LCP text waits on JS hydration.

- [ ] **Server-render the hero shell.** Split `landing-page.tsx`: the static hero (`<h1>`, subhead, CTAs) becomes a server component (paints immediately, no JS); only the animated `HeroAskDemo` stays a client island. Biggest single LCP win.
- [ ] **Code-split the demo.** `hero-ask-demo/index.tsx` statically imports **all 4 variants** but only `"device"` is used — `dynamic()`-import just that one; drop 3 unused components from the bundle.
- [ ] **Ensure the homepage is statically generated / ISR** (marketing page — shouldn't render dynamically per request). Confirm no accidental `dynamic` data fetch on `/`.
- [ ] **Delete the orphan `public/main-video.mp4` (38 MB)** — unreferenced dead weight in the repo.
- [ ] **Defer non-critical third-party scripts** further: Meta Pixel + Rewardful → `strategy="lazyOnload"` (GA can stay `afterInteractive`). Consider consent-gating.
- [ ] Re-measure in PageSpeed Insights (mobile) + Vercel Speed Insights; target LCP < 2.5s, keep the 99 desktop.
- [ ] Fonts are already system-native (no web-font blocking) — leave as is. ✅

### Phase 4 — GEO content infrastructure (depends on Part 5 decision)
The agency will write content (Part 12/13 of the audit: "how to verify a broker", "avoid scam brokers", "prop-firm verification", etc.). **We build the machine that publishes it** — there is currently **no blog/article system**.

- [ ] **Decide the publishing pipeline** (see Part 5): MDX-in-repo vs. Supabase-backed CMS vs. headless CMS. This is the big architectural fork.
- [ ] Build `/blog` (or `/learn`) index + article route with: article schema (`Article`/`BlogPosting`), breadcrumb schema, FAQ blocks, author/E-E-A-T markup, TOC, internal-linking component, and answer-first templates (H2-as-question → direct answer).
- [ ] Reusable **FAQ component** that renders both the accordion UI *and* the `FAQPage` JSON-LD from one data source (use it on landing, methodology, and each article).
- [ ] Comparison-table component (real `<table>` HTML — AI engines extract these well) for broker/prop-firm comparisons.

### Phase 5 — Measurement (½ day, ongoing)
- [ ] Verify **Google Search Console** (submit the sitemap, watch Coverage/Indexing) + **Bing Webmaster** (feeds Copilot).
- [ ] Track AI citation share manually or via a GEO tool for the priority queries.
- [ ] Watch Core Web Vitals in Search Console after Phase 3.

---

## Part 4 — Suggested sequencing

```
Week 1:  Phase 0 (metadata) + Phase 2 (robots/sitemap/redirect) + Phase 5 setup   ← fast, high ROI
Week 1–2: Phase 1 (schema/JSON-LD)
Week 2:  Phase 3 (mobile LCP)
Week 3+: Phase 4 (content pipeline) — starts once the content decision is made
```
Phases 0–3 are self-contained code and can ship without the agency. Phase 4 unblocks the agency's content work.

---

## Part 5 — Decisions we need (from you / the client / the agency)

1. **Content pipeline** — how will the agency's articles get published? **Recommendation: MDX files in-repo** (`content/blog/*.mdx`) — zero infra cost, version-controlled, fast, and we already deploy on Vercel. Alternative: Supabase-backed (they already use it) if non-devs must publish without a PR.
2. **Public vs gated pages** — are `/ask`, `/markets`, `/guide`, `/tools` supposed to be indexable marketing pages or logged-in-only? This decides the sitemap/robots/middleware reconciliation.
3. **AI training crawlers** — allow AI *citation* crawlers (yes, recommended). Separately: allow AI *training* crawlers (`GPTBot`)? For a new brand chasing visibility, **allow both** is the simplest and most visibility-positive choice, but it's a brand call.
4. **Social/OG image** — do we have brand assets for a 1200×630 OG image, or should we generate one?
5. **Reviews** — do we have real user ratings? (Needed before any `aggregateRating` schema — otherwise we omit it.)

---

## Appendix — Files we'll touch

- `src/lib/site-config.ts` — add `SITE_URL`, social handles.
- `src/app/layout.tsx` — `metadataBase`, `title.template`, default OG/Twitter, Organization+WebSite JSON-LD.
- `src/app/robots.ts` — AI-crawler rules, `host`, shared base URL.
- `src/app/sitemap.ts` — real public URL set, stable `lastModified`.
- `src/app/page.tsx` + each public `page.tsx` — `alternates.canonical`, unique title/desc for `/guide`,`/tools`.
- `src/lib/seo/schema.ts` (new) + `src/components/seo/json-ld.tsx` (new) — schema builders.
- `src/components/landing/landing-page.tsx` + `hero-ask-demo/*` — server/client split, code-split variants.
- `public/main-video.mp4` — delete (38 MB orphan).
- `public/llms.txt` (new, optional) — curated map for non-Google AI engines.
- Vercel dashboard — apex→www 308 redirect.
