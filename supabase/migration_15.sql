-- Welcome email dedup markers for Resend transactional mail.

alter table public.profiles
  add column if not exists signup_welcome_email_sent_at timestamptz;

alter table public.billing_subscriptions
  add column if not exists welcome_email_sent_at timestamptz;
