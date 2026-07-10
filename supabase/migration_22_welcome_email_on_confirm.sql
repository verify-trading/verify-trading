-- Migration 22 — event-driven signup welcome email on email confirmation
--
-- Apply on the production database (Supabase SQL editor). Idempotent; safe to
-- re-run.
--
-- Problem: the signup welcome email was only sent from the browser
-- /auth/callback after a successful PKCE code exchange. When that exchange fails
-- (confirmation opened on a different device/browser, expired or reused link)
-- the user is still confirmed but never receives the welcome email, and there is
-- no retry — this dropped ~8% of post-launch signups.
--
-- Fix: fire a webhook the instant auth.users.email_confirmed_at goes
-- NULL -> NOT NULL, calling the app endpoint which sends the email through the
-- existing idempotent path (profiles.signup_welcome_email_sent_at claim).
--
-- Google / OAuth users are confirmed at row INSERT (no NULL -> NOT NULL UPDATE),
-- so this trigger does NOT fire for them — they keep the /auth/callback path.
--
-- PREREQUISITES (do these BEFORE applying this migration):
--   1. Deploy the app so this endpoint is live:
--        POST https://www.verify.trading/api/hooks/email-confirmed
--   2. Set the Vercel env var  WELCOME_EMAIL_HOOK_SECRET = <random secret>.
--   3. Store the SAME value in Supabase Vault under the name below:
--        select vault.create_secret('<random secret>', 'welcome_email_hook_secret');
--   4. Ensure the pg_net extension is enabled (the statement below handles it,
--      or enable it via Dashboard -> Database -> Extensions -> pg_net).

create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Trigger function: POST { userId } to the app on first email confirmation.
-- security definer so it can read the Vault secret; wrapped so a webhook/pg_net
-- failure can NEVER block the auth transaction (email confirmation must succeed
-- even if the notification does not).
-- ---------------------------------------------------------------------------
create or replace function public.notify_signup_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  select decrypted_secret
    into v_secret
    from vault.decrypted_secrets
    where name = 'welcome_email_hook_secret'
    limit 1;

  perform net.http_post(
    url := 'https://www.verify.trading/api/hooks/email-confirmed',
    body := jsonb_build_object('userId', new.id::text),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(v_secret, '')
    ),
    timeout_milliseconds := 5000
  );

  return new;
exception
  when others then
    -- Swallow everything: never let a welcome-email notification break signup.
    return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
after update of email_confirmed_at on auth.users
for each row
when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function public.notify_signup_email_confirmed();
