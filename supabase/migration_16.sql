-- Allow weekly checkout sessions now that Pro Weekly is a public billing plan.

alter table public.billing_checkout_sessions
  drop constraint if exists billing_checkout_sessions_plan_check;

alter table public.billing_checkout_sessions
  add constraint billing_checkout_sessions_plan_check
  check (plan in ('weekly', 'monthly', 'annual'));
