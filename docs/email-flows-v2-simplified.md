# Verify Trading — Email Flows v2 (Simplified)

Revision of the client's two Resend specs. Goal: keep the strategy and psychology of the originals, but cut volume and complexity so we protect deliverability (inbox placement, sender reputation) and don't overwhelm users. Every email cut here stays on the roadmap for phase 2 — nothing is deleted, only sequenced.

**What changed vs. the original spec, in one line each:**

- Free flow: 11 scheduled emails → 6, behavioral branches 4 → 2
- Pro flow: same skeleton, but emails that depend on unbuilt features or heavy analytics are deferred
- New engagement-based suppression rules (the actual anti-spam-folder mechanism)
- One timezone-aware scheduler powers both flows

---

## Deliverability rules (both flows)

These matter more for inbox placement than any copy change:

1. **Max 1 email per user per 24h** (kept from original). Behavioral beats scheduled.
2. **Engagement pause (new):** if a user hasn't opened the last 3 emails, pause their sequence. Resume only on a product event (login, ask, journal entry). Sending to non-openers is the #1 way to end up in spam.
3. **Sunset policy (new):** no opens AND no logins for 60 days → stop emailing entirely except transactional. Re-entry only via win-back (separate, tiny).
4. **Hard suppression** (kept): unsubscribe / bounce / spam complaint → never again. Wired via Resend webhook, enforced before every send.
5. **Pro upgrade instantly kills all free-flow upsell.**
6. **One sending domain:** everything from `verify.trading` (`ai@` for free, `pro@` for Pro — `pro@` needs creating). DKIM/SPF/DMARC verified on `verify.trading`, not `verifytrading.com` — the original spec mixes the two domains up.
7. **Warm-up:** first 2–4 weeks, ramp volume gradually rather than blasting the full list.
8. **Plain-looking emails:** short, mostly text, one CTA, 600px, real plain-text part. The original copy already reads this way — keep it. No image-heavy templates.
9. **List hygiene:** only emails from confirmed signups enter flows (already true — signup requires email confirmation).

---

## Flow 1 — Free users (6 emails over 30 days, `ai@verify.trading`)

Same four-act arc as the original (trust → habit → identity → sell), roughly half the volume.

| # | Day | Subject (from original) | Purpose |
|---|-----|------------------------|---------|
| 1 | 0 | Your first check is waiting | Activation: run first broker check |
| 2 | 2 | The £250/hour Lambo loophole | Trust: we expose fakes, we don't sell hype |
| 3 | 4 | Why I built this (and why it matters) | Trust: founder story, no CTA |
| 4 | 9 | Why preparation beats prediction | Habit: daily AI asks, pre-market routine |
| 5 | 15 | Why you keep making the same mistake | Identity: AI Journal / Pro features intro |
| 6 | 26 | The cost of one bad trade | Sell: single clear Pro pitch + "last email" line folded in |

**Cut from v1 (→ phase 2):** Day 6 workflow email (duplicate of Day 9's message), Day 12 and Day 18 identity emails (three pitches for the same conclusion), Day 22 OS pitch and Day 30 final push (merged into #6).

**Behavioral branches — keep 2 of 4:**

| Branch | Trigger | Email |
|--------|---------|-------|
| Power user | Hits 5/5 free asks in a day | Upsell within 15 min (original Branch A copy) |
| Inactive | No login for 5 days | "See which brokers failed this week" (original Branch D) |

**Deferred:** Emoter and Skeptic — both need trade-log/cross-feature analytics that don't exist yet, for the two lowest-intent segments. Revisit when the data is there.

---

## Flow 2 — Pro users (`pro@verify.trading`)

Keep the original's product-led philosophy: the app carries the habit, email supports it. A well-behaved Pro user gets ~1 email/week in month 1, then ~1/month.

### Scheduled

| # | When | Subject | Purpose |
|---|------|---------|---------|
| 1 | Day 0 (on upgrade) | Welcome to Pro. Let's start with you. | Psychology assessment |
| 2 | Day 2, 6:30 AM local | Your pre-market routine just got shorter. | Intelligence Hub habit |
| 3 | Day 7 | You aren't trading alone anymore. | Members chat |
| 4 | Every Sunday 4 PM local | Your weekly debrief. | The retention workhorse — outranks all other email that day |
| 5 | 30th journal entry | The pattern hiding in your last 30 trades. | Milestone insight |
| 6 | Day 90 (+50 entries) | Are you a better trader than 90 days ago? | Quarterly report |
| 7 | Day 180 | Half the year gone. Here is your edge. | Six-month report |

### Behavioral

| # | Trigger | Email |
|---|---------|-------|
| 8 | Broker not connected 48h after upgrade | Your AI Companion is waiting. |
| 9 | No login for 7 days | The market moved while you were away. |
| 10 | TRS tier up / tier at risk | You just leveled up. / Your {tier} status is at risk. *(only once TRS ships in-product)* |
| 11 | 100+ asks AND broker AND 20+ journals (monthly plan) | Annual upgrade pitch with their own stats |

**Deferred to phase 2 (with reason):**

- **Day 5 "We found a leak"** — only send once the AI Journal genuinely generates per-user insights, and gate it on `broker_connected == true`. Sending a canned "insight" from a data-verification brand is a trust killer.
- **3-loss-streak email + profitable-week email** — need reliable per-trade result data. Keep the *in-app* 4-hour lockout though; that's the valuable half and it's product, not email.
- **Overwhelmed / frustrated detection** — requires session-behavior analytics; marginal return.
- **Affiliate auto-qualification** — run as a manual monthly query until user volume justifies automating it.
- **Weekly→Monthly pitch** — only if the weekly plan exists and has meaningful volume.
- **Cancel flow** stays entirely in-app (as the original specifies); win-back sequence specced separately later.

**Kept as product-only (no email), per the original:** Day 1 broker import, pre-market checklist, referral share buttons, community chat prompts, cancel-flow pause offer.

---

## Volume comparison

| | Original spec (worst case, 30 days) | v2 |
|---|---|---|
| Free user | up to ~15 | 6–8 |
| New Pro user, month 1 | ~8–10 | ~5–6 |
| Pro user, months 2–12 | several/month | ~1/month + Sunday debrief |

## Build order

1. Resend domain setup on `verify.trading` (DKIM/SPF/DMARC), create `pro@`, webhook for bounces/complaints/unsubscribes → suppression table
2. Timezone-aware scheduler (one cron system, both flows) + event tracking for the simple counters: ask count, journal count, broker_connected, last_active, plan_type
3. Free flow (6 + 2 emails) — templates from original copy
4. Pro flow scheduled emails, then behavioral
5. Measure for 30 days (opens, unsubscribes, spam rate <0.1%, upgrade conversions) → decide which phase-2 emails to switch on

## Open items to confirm with client

- Email 3 timing: spec says Day 4 but also "96h after Email 2" (= Day 6). v2 uses Day 4.
- "Green week" email copy is missing its first line in the original.
- Which product features are actually live today: TRS tiers, AI Journal insights, pre-market checklist, 4-hour lockout, pause-subscription option? Emails referencing unbuilt features stay off until the feature ships.
