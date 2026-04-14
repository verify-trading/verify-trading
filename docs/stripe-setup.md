# Stripe Setup Checklist

This app is now wired for Stripe-hosted subscription checkout, a Stripe customer portal, webhook-driven subscription sync, and a `/billing` page in the app.

The public pricing model is:

- `Free`
- `Pro Monthly`
- `Pro Annual`

The launch/founder deal is not a separate public plan. It is a temporary promotion layered onto `Pro Monthly`.

## What The Code Expects

The app uses three recurring Stripe prices:

1. `STRIPE_PRICE_PRO_MONTHLY_PROMO`
   - Monthly recurring price for the launch cohort
   - Amount: `£20/month`
   - Subscribers created on this price stay on `£20/month` ongoing

2. `STRIPE_PRICE_PRO_MONTHLY_STANDARD`
   - Monthly recurring price for the regular cohort
   - Amount: `£24.99/month`

3. `STRIPE_PRICE_PRO_ANNUAL`
   - Yearly recurring price for the annual cohort
   - Amount: `£200/year`

The app also expects one coupon:

4. `STRIPE_PROMO_COUPON_ID`
   - Applies to the monthly launch checkout only
   - Amount off: `£15`
   - Duration: `once`
   - Result: first invoice becomes `£5`, then the recurring `£20/month` price continues

The launch offer is active until:

- `STRIPE_PROMO_END_AT`
- Default: `2026-06-06T00:00:00+01:00`

If you want a different cutoff, change that env var.

## Stripe Dashboard Tasks

1. Create product: `verify.trading Pro`
2. Create price A:
   - recurring monthly
   - currency `GBP`
   - amount `20.00`
3. Create price B:
   - recurring monthly
   - currency `GBP`
   - amount `24.99`
4. Create price C:
   - recurring yearly
   - currency `GBP`
   - amount `200.00`
   - confirm this is `GBP`, not `USD`, before copying the final price ID into env
5. Create coupon:
   - fixed amount off `15.00 GBP`
   - duration `once`
6. Enable the Stripe customer portal
7. In the customer portal settings, enable subscription updates so users can switch between monthly and annual plans
8. Optional: create a dedicated portal configuration and copy its ID

## Environment Variables

Set these in `.env.local` for local work and in Vercel for production:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY_PROMO=price_...
STRIPE_PROMO_COUPON_ID=coupon_...
STRIPE_PRICE_PRO_MONTHLY_STANDARD=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
STRIPE_PORTAL_CONFIGURATION_ID=bpc_... # optional
STRIPE_PROMO_END_AT=2026-06-06T00:00:00+01:00 # optional
```

## Supabase Tasks

Run the new SQL migrations:

```bash
supabase/migration_8.sql
supabase/migration_9.sql
supabase/migration_10.sql
```

This adds:

- `profiles.stripe_customer_id`
- `billing_subscriptions`
- `stripe_webhook_events`

The app still uses `profiles.tier` as the main entitlement flag. Webhooks update that automatically.

## Webhook Setup

Create a Stripe webhook endpoint that points to:

- Local: `http://localhost:3000/api/stripe/webhook`
- Production: `https://YOUR-DOMAIN/api/stripe/webhook`

Subscribe to these events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

For local development with Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## How The Flow Works

1. User opens `/billing`
2. Clicking the checkout button calls `POST /api/stripe/checkout`
3. The server picks the correct Stripe price based on the selected plan and the promo deadline
4. Monthly before the deadline:
   - checkout uses the `£20/month` recurring price
   - the one-time `£15` coupon makes invoice one equal `£5`
5. Monthly after the deadline:
   - checkout uses the `£24.99/month` recurring price
   - no launch coupon is applied
6. Annual:
   - checkout uses the `£200/year` recurring price
   - no launch coupon is applied
7. Existing subscribers can open the Stripe subscription update flow from `/pricing` to switch between monthly and annual
8. In-app cancellation:
   - users can set `cancel_at_period_end` from `/billing`
   - users can also resume renewal before the end date
9. Stripe webhook sync updates:
   - `billing_subscriptions`
   - `profiles.stripe_customer_id`
   - `profiles.tier`

## Recommended Test Pass Tomorrow

1. Run the migration in Supabase
2. Fill Stripe env vars locally
3. Start the local app
4. Start Stripe CLI forwarding
5. Create a new test user
6. Open `/billing`
7. Start a monthly checkout
8. Complete payment with a Stripe test card
9. Confirm:
   - user lands back on `/billing`
   - `profiles.tier` becomes `pro`
   - `billing_subscriptions.status` becomes `active` or `trialing`
   - the billing portal opens from the same page
10. Test the in-app `Cancel at period end` button and confirm the subscription updates locally
11. Test the in-app resume button and confirm it clears the cancellation flag
12. Test the annual checkout path and confirm the stored recurring interval is `year`
13. Test switching from monthly to annual or annual to monthly from `/pricing` and confirm webhook sync updates the database
14. Optionally test canceling from the portal too and confirm webhook sync updates the database

## Notes

- Existing app access checks already key off `profiles.tier`, so Ask/Markets do not need extra billing logic.
- Launch customers stay on `£20/month` because they are attached to a dedicated recurring monthly price ID.
- Annual customers use a separate `£200/year` Stripe price.
- The UI should always present pricing as `Free`, `Pro Monthly`, and `Pro Annual`; launch copy is only promotional messaging on the monthly card.
- If you want to change copy later, the main pricing text lives in `src/lib/billing/config.ts`.
