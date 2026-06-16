# verify.trading Mobile + Web Architecture

Status: architecture handoff  
Date: May 26, 2026  
Inputs: current `verify-trading` web app, `app-build-brief.docx`, `psychology-ai-buildguide.docx`, `journal-build-v2.docx`

## 1. Source of Truth

The current web application remains the source of truth for the existing product: authentication, billing, Ask, Markets, Guide, Tools, legal pages, affiliate links, and Stripe subscription state.

The mobile build brief is the source of truth for the mobile shell, app navigation, onboarding, notifications, More tab, chat room, and mentorship links.

The final Psychology AI build guide replaces the shorter Psychological AI section in the app build brief.

The final Journal Tab v2 build guide replaces the shorter Trading Journal section in the app build brief.

Unlimited-related language in the app brief should not override the current web app entitlement model. The current web implementation uses `5` Ask queries per day for free users and `20` Ask queries per day for Pro users. Markets APIs require Pro access. The mobile app should follow the same backend limits unless the web product is deliberately changed later.

## 2. Existing Web Platform

Current stack:

- Next.js 16 App Router
- React 19
- Supabase Auth, Postgres, RLS, Storage
- Stripe Checkout, webhooks, customer portal
- Anthropic via AI SDK
- Financial Modeling Prep / market data adapters
- Resend transactional email
- React Query, Zustand, Zod, Recharts, PDF viewer

Current primary web routes:

- `/` landing page
- `/login`, `/signup`, `/forgot-password`, `/auth/callback`, `/auth/update-password`
- `/ask`
- `/markets`
- `/tools`
- `/guide`
- `/pricing`
- `/billing`
- `/affiliates`
- `/terms`, `/privacy`, `/cookies`, `/risk-disclosure`

Current backend routes:

- `POST /api/ask`
- `GET /api/ask/history`
- `GET|POST /api/ask/sessions`
- `GET|PATCH|DELETE /api/ask/sessions/[sessionId]`
- `GET /api/markets`
- `GET /api/markets/intelligence`
- `GET /api/markets/calendar`
- `POST /api/stripe/checkout`
- `POST /api/stripe/webhook`
- `POST /api/stripe/customer-portal`
- `POST /api/stripe/sync-checkout`
- `POST /api/stripe/subscription`
- `GET /api/cron/markets`
- `GET /guide-pdf`

Current entitlement model:

- `profiles.tier = 'free' | 'pro'`
- Free users: signed in, limited Ask usage.
- Pro users: paid/trialing/past-due subscription statuses grant Pro.
- Markets API requires a signed-in Pro session.
- Billing subscriptions are synced from Stripe webhooks into Supabase.

## 3. Target Product Shape

The product becomes one shared account across web and mobile:

- One Supabase user.
- One Stripe customer.
- One subscription state.
- One profile tier.
- Shared Ask history where practical.
- Mobile-only Journal and Psychology AI data stored in the same Supabase project.

The web app remains the main acquisition, billing, guide, and desktop workflow surface.

The mobile apps provide the Pro mobile experience:

- Native Ask
- Native Markets and Intelligence
- Journal
- Psychology AI
- Members Chat Room
- Mentorship and support hub
- Push notifications

## 4. Mobile App Architecture

Recommended stack:

- React Native with Expo
- TypeScript
- Expo Router or React Navigation bottom tabs plus nested stacks
- Supabase JS client for Auth
- React Query for server cache
- Zustand for local UI state where needed
- Expo SecureStore for sensitive session persistence
- Expo Notifications for push token registration
- Native speech-to-text where available for Psychology AI
- ElevenLabs for high quality TTS, with device TTS fallback
- Stream Chat SDK for native member chat if budget is approved

Mobile tabs:

- Ask
- Markets
- Intelligence
- Journal
- More

Recommended nested navigation:

- `AskStack`: Ask workspace, attachment preview, session history
- `MarketsStack`: markets list, asset detail handoff to Ask
- `IntelligenceStack`: daily brief, market radar, economic calendar
- `JournalStack`: calendar, day view, entry form, challenge setup
- `MoreStack`: profile, subscription, Psychology AI, chat, mentorship, guide, support, settings

Psychology AI can be launched from the More tab and from notifications. If the product wants it as a top-level tab later, it can replace Intelligence or move Intelligence under Markets.

## 5. Authentication and Subscription

Supabase Auth should remain the identity provider for both web and mobile.

Mobile login:

- Email/password login
- Email/password signup
- Forgot password
- Google sign-in if already configured for the web project
- Optional Apple sign-in later if App Store review requires it for parity with other social sign-in options

Access control:

- Mobile reads `profiles.tier`.
- Pro-only mobile features are gated client-side and server-side.
- All writes to Journal, Psychology AI, notification tokens, and chat identity endpoints require an authenticated user.
- Do not create a separate `app_access` entitlement unless there is a business need to treat mobile access differently from web Pro.

Billing:

- Keep Stripe Checkout on the web backend.
- Mobile upgrade CTA should open the existing web checkout URL or pricing page in an external browser / system web session.
- Native in-app purchases are not part of the current architecture.
- Stripe webhooks continue syncing `billing_subscriptions` and `profiles.tier`.

## 6. Shared Backend Boundaries

Use the existing Next.js app as the API backend for mobile. This avoids duplicating business rules in the app.

Recommended new API groups:

- `/api/mobile/bootstrap`
- `/api/journal/*`
- `/api/psychology/*`
- `/api/notifications/*`
- `/api/chat-token`
- `/api/mentor-links`

`GET /api/mobile/bootstrap` should return:

- user id, email, display name
- profile tier
- billing status summary
- Ask usage summary
- app feature flags
- support email
- external links: community, Calendly, academy, affiliate dashboard

API rules:

- Validate all request bodies with Zod.
- Use Supabase server/admin clients only on the backend.
- Keep RLS enabled for user-owned tables.
- Never expose service role keys to mobile.
- Mobile should call backend APIs for AI, scraping, TTS token workflows, chat token generation, and billing handoffs.

## 7. Ask Architecture

Web Ask already supports:

- Auth-required chat.
- Persisted sessions and messages.
- Structured card outputs for broker checks, briefings, calculators, gurus, insights, plans, charts, setups, projections.
- Image upload validation.
- Rate limits through daily usage reservation.
- Anthropic model routing.

Mobile Ask should reuse:

- `POST /api/ask`
- Ask sessions APIs
- Existing card schemas and UI metadata
- Existing free/pro usage limits

Mobile Ask UX:

- Native chat UI with dark navy background.
- Suggested prompts on empty state.
- Usage counter for free users.
- Pro users see plan state without “unlimited” copy unless the web app changes.
- Markets, Intelligence, Calendar, Journal, and Psychology AI can deep-link into Ask with prefilled prompts.

## 8. Markets and Intelligence

Current web Markets:

- Pro-gated API.
- Cached quotes, sparklines, and timeframe series.
- Market intelligence feed.
- Economic calendar feed.
- Dashboard tiles for key forex, commodities, indices, and crypto assets.

Mobile should reuse:

- `GET /api/markets`
- `GET /api/markets/intelligence`
- `GET /api/markets/calendar`
- Current market cache cron pipeline

Mobile Markets:

- Group assets by category.
- Show price, 24h or selected-period change, market status, and sparkline.
- Asset tap opens Ask with: `Brief me on [asset] before this session. Key levels, bias and what to watch.`
- Bottom actions: Book a call with Dan, Join Community.

Mobile Intelligence:

- Daily brief card for Gold, Oil, EUR/USD, GBP/USD.
- Session tone.
- Market radar headlines.
- Headline tap opens Ask with headline context.

Economic Calendar:

- Weekly event list.
- High/medium/low impact dots.
- Next high-impact countdown.
- Event tap opens Ask with pre-release or post-release prompt depending on available actual data.

## 9. Journal Architecture

The Journal is mobile-first and app-only at launch. The final Journal v2 document is the source of truth.

Core principle:

- Private session diary.
- Under 60 seconds to add an entry.
- No broker sync, screenshots, complex tagging, backtesting, public profile, or social sharing.

Screens:

- Journal calendar home
- Day entry view
- New/edit entry form
- Quick entry bottom sheet
- Challenge setup
- Overheat modal

Key features:

- Personal Account / Challenge Mode toggle.
- Month calendar with mood dot, P&L heatmap, best session marker.
- 30-day mood trend bar.
- Lesson count and positive-session stat cards.
- Weekly AI insight card.
- Recent lessons.
- Winning and losing streak heat badge.
- Overheat popup for streak and P&L thresholds.
- Challenge Mode rule scraping and challenge status note.

Journal data model:

```sql
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  mood text not null check (mood in ('good', 'okay', 'tough')),
  pnl double precision,
  note text,
  lesson text,
  unique (user_id, entry_date)
);

create table public.journal_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  insight_text text not null,
  generated_at timestamptz not null default now()
);

create table public.challenge_config (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  firm_name text,
  firm_url text not null,
  account_size double precision not null,
  account_type text not null check (account_type in ('2step', '1step', 'instant')),
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.overheat_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trigger_type text not null check (trigger_type in ('winning_streak', 'losing_streak', 'pnl_overheat')),
  trigger_value double precision not null,
  user_response text not null check (user_response in ('break', 'reduced_size')),
  created_at timestamptz not null default now()
);
```

Journal API:

- `GET /api/journal/month?month=YYYY-MM`
- `GET /api/journal/day?date=YYYY-MM-DD`
- `PUT /api/journal/day`
- `DELETE /api/journal/day?date=YYYY-MM-DD`
- `POST /api/journal/quick-entry`
- `GET /api/journal/insight`
- `POST /api/journal/insight/generate`
- `GET /api/journal/challenge`
- `POST /api/journal/challenge/scrape`
- `PATCH /api/journal/challenge`
- `POST /api/journal/overheat`

Computed values should be returned from API response helpers, not stored:

- journaling streak
- winning streak
- losing streak
- total P&L
- win rate / positive-session rate
- lesson count
- best session of current month
- 30-day mood trend

## 10. Psychology AI Architecture

The final Psychology AI build guide is the source of truth. It replaces the simple 5-question readiness check in the app brief.

The Psychology AI tab has only two components:

- 30-question tap-based assessment.
- Voice-only AI companion.

It does not contain:

- pre-session checklist
- trading rules list
- market data
- text input
- trade scoring

Permanent privacy line:

> These conversations are private and never shared.

Assessment:

- Full screen per question.
- No scrolling.
- No back button.
- Progress bar.
- Section label.
- Four full-width tap answers.
- Questions 1-5 stored as context only.
- Questions 6-30 scored 0-3.
- Max score 75.
- Store section scores, total score, zone label, highest section, Q29 focus, and flags.

Score zones:

- `0-18`: Disciplined Trader
- `19-37`: Developing Trader
- `38-56`: Reactive Trader
- `57-75`: At-Risk Trader

Flags:

- `flag_chasing`
- `flag_compulsive`
- `flag_financial_pressure`
- `flag_sleep_poor`
- `flag_rebuilding`

Results:

- Large circular score dial.
- Zone label.
- Five section bars.
- Claude generates spoken result under 120 words.
- ElevenLabs plays the result automatically, with device TTS fallback.
- Button: Talk to your AI coach.

Companion:

- Voice only.
- User taps mic, speaks, stops or silence is detected.
- Speech-to-text transcript is sent to backend.
- Backend builds companion prompt with assessment, flags, and journal summary.
- Claude returns a concise spoken response.
- ElevenLabs or device TTS plays response.
- Session metadata is stored.

Psychology data model:

```sql
create table public.psychology_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  q1_trading_situation text not null,
  q2_stress_level text not null,
  q3_financial_situation text not null,
  q4_sleep_quality text not null,
  q5_energy_level text not null,
  section_wrong_score integer not null,
  section_fear_score integer not null,
  section_compulsion_score integer not null,
  section_awareness_score integer not null,
  section_discipline_score integer not null,
  total_score integer not null check (total_score between 0 and 75),
  zone_label text not null,
  highest_section text not null,
  q29_focus text not null,
  flag_chasing boolean not null default false,
  flag_compulsive boolean not null default false,
  flag_financial_pressure boolean not null default false,
  flag_sleep_poor boolean not null default false,
  flag_rebuilding boolean not null default false
);

create table public.psychology_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_id uuid references public.psychology_assessments(id) on delete set null,
  created_at timestamptz not null default now(),
  duration_secs integer,
  message_count integer not null default 0,
  break_recommended boolean not null default false
);
```

Optional if transcripts are approved later:

```sql
create table public.psychology_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.psychology_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  transcript text not null,
  created_at timestamptz not null default now()
);
```

Given the privacy promise, transcripts should be disabled by default or explicitly approved. Store metadata first; only store transcripts if product/legal agrees.

Psychology API:

- `GET /api/psychology/latest-assessment`
- `POST /api/psychology/assessment`
- `POST /api/psychology/verbal-result`
- `POST /api/psychology/session`
- `POST /api/psychology/respond`
- `PATCH /api/psychology/session/[id]/finish`

Journal feed into Psychology AI:

- sessions in last 7 days
- wins / losses or positive / negative sessions
- weekly P&L
- tough sessions
- current winning or losing streak
- recent overheat logs

The companion should never say it is reading database fields. It should reference patterns naturally.

## 11. Members Chat Room

Launch options:

- Preferred: Stream Chat native SDK.
- Fallback: in-app webview or external link to Telegram community.

Recommended architecture if using Stream:

- Backend endpoint `POST /api/chat-token`.
- Endpoint verifies authenticated Pro user.
- Endpoint upserts Stream user profile and returns short-lived chat token.
- Mobile joins a single launch channel.
- Omar and Dan are admins.
- Bot/moderation rule removes links from non-admins.

Rules shown on first entry:

- No signals.
- No promotions.
- No broker recommendations without BTS score.

## 12. More Tab

More tab contents:

- Profile: name, email, subscription status, member since.
- Subscription: current plan, next billing date, manage subscription.
- Affiliate: Rewardful dashboard link.
- Psychology AI entry point.
- Members Chat Room.
- Mentorship: `verifytrading.academy`, showing Coming Soon until live.
- User Guide: native PDF viewer or existing `/guide`/`/guide-pdf`.
- Support: `ai@verify.trading`.
- Share app.
- Rate app.
- Notification preferences deep link.
- Log out.
- Delete account with confirmation.

## 13. Push Notifications

Use Expo Notifications and store device tokens in Supabase.

Data model:

```sql
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Notification API:

- `POST /api/notifications/register`
- `POST /api/notifications/unregister`
- `PATCH /api/notifications/preferences`

Notification jobs:

- Morning brief: weekdays 07:00 GMT.
- High-impact economic event: 30 minutes before event.
- Psychology AI prompt: weekdays 07:15 GMT for Pro users.
- Journal reminder: 21:00 GMT if no entry today.
- Inactivity: Pro user inactive for 7 days.

Delivery should run server-side from Supabase Cron or a scheduled backend worker. Do not schedule critical product notifications only on device.

## 14. Design System

Shared palette:

- Background: `#06081C`
- Card: `#0B0E38`
- Card dark: `#0D1240`
- Coral: `#F26D6D`
- Blue: `#4C6EF5`
- Bright green: `#16A34A`
- Green: `#22C55E`
- Amber: `#F59E0B`
- Deep red: `#DC2626`
- Gold: `#EAB308`
- White: `#FFFFFF`
- Light grey: `#C8D0E7`
- Muted: `#5A6380`
- Border: `#1A2050`

Principles:

- Dark mode only at launch.
- Data should be visually dominant.
- One primary action per screen.
- Coral is for primary CTAs and urgent states.
- Blue is for info, links, active tabs, and Challenge Mode.
- Minimum tap target: 44pt.
- Skeleton loading on all list views.
- No blank loading states.
- Use geometric mood indicators for Journal rather than emoji mood faces.

## 15. Security and Privacy

Required:

- Keep Supabase service role, Stripe secret, Anthropic key, ElevenLabs key, market data keys, and Stream secret server-only.
- RLS on all user-owned tables.
- Backend validates entitlement before all Pro-only actions.
- Mobile never trusts local profile tier for writes.
- Store push tokens per user and allow logout/unregister.
- Delete-account flow must remove or anonymize user-owned app data according to policy.
- Psychology AI privacy promise must match storage behavior.

AI safety boundaries:

- Psychology AI is mental performance coaching, not therapy or emergency care.
- It should not give trade recommendations.
- It should not diagnose mental health conditions.
- It should recommend breaks and risk reduction naturally when journal patterns are concerning.

## 16. Build Phases

Phase 1: Mobile Core

- Expo app setup.
- Auth and session persistence.
- Bootstrap API.
- Bottom tabs and design system.
- Ask mobile UI reusing existing Ask API.
- Markets, Intelligence, Economic Calendar reusing existing APIs.
- Billing handoff to web checkout / portal.

Phase 2: Journal Core

- Journal migrations and RLS.
- Calendar home.
- Day view.
- New/edit entry form.
- Quick entry.
- Computed stats.
- Recent lessons and mood trend.

Phase 3: Journal Intelligence

- Streak calculations.
- Overheat modal and logs.
- Challenge Mode configuration.
- Server-side rule extraction.
- Challenge status note.
- Weekly AI insight generation.

Phase 4: Psychology AI Assessment

- Psychology migrations and RLS.
- 30-question assessment.
- Score calculation and flags.
- Results screen.
- Claude verbal result.
- TTS playback.

Phase 5: Psychology AI Companion

- Voice screen.
- Speech-to-text.
- Companion backend endpoint.
- Journal context injection.
- Session metadata.
- Retake assessment with comparison.
- Break recommendation logic.

Phase 6: Community, Notifications, Polish

- Stream Chat or Telegram fallback.
- Push token registration.
- Scheduled notifications.
- More tab completion.
- Guide/support/affiliate/mentorship links.
- App store metadata, QA, and submission.

## 17. Open Decisions

- Confirm whether Stream Chat budget is approved. If not, ship Telegram link first.
- Confirm ElevenLabs budget. If not, use native TTS for launch.
- Confirm whether Psychology AI transcripts may be stored. Default recommendation: do not store transcripts.
- Confirm whether Apple sign-in is required at launch based on final auth-provider mix.
- Confirm exact mobile upgrade handoff behavior for App Store review. Prefer external browser/system web auth session over an embedded payment webview.
- Confirm whether Journal and Psychology AI should remain mobile-only or later appear on web.
- Confirm whether a pre-session checklist exists anywhere. The final Psychology AI guide excludes it from Psychology AI, and the final Journal v2 guide excludes it from Journal, so this architecture omits it until product clarifies ownership.
