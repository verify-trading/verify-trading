-- Migration 23 — welcome email for users confirmed at creation (Google OAuth, auto-confirm)
--
-- Apply on the production database (Supabase SQL editor). Idempotent; safe to re-run.
--
-- Complements migration_22. Together the two triggers make the webhook endpoint
-- (/api/hooks/email-confirmed) the SINGLE source of the signup welcome email:
--   - migration_22 (UPDATE, email_confirmed_at NULL -> NOT NULL): email signups
--     that confirm later.
--   - this one (INSERT, email_confirmed_at already set at creation): Google/OAuth
--     and any auto-confirmed users, who never get a NULL -> NOT NULL update.
--
-- The app's /auth/callback no longer sends welcome emails, so this closes the gap
-- where a failed OAuth callback exchange left a Google user with no welcome.
--
-- Email signups INSERT with email_confirmed_at NULL, so this trigger does NOT fire
-- for them (migration_22 covers them on confirmation). handle_new_user (migration_3)
-- creates the profile in the same INSERT transaction, and net.http_post is async
-- (fires post-commit), so the profile row always exists by the time the webhook
-- runs — no race.
--
-- PREREQUISITES (same as migration_22): endpoint deployed, Vercel env
-- WELCOME_EMAIL_HOOK_SECRET set, Vault secret welcome_email_hook_secret set to the
-- same value, pg_net enabled.

create extension if not exists pg_net;

create or replace function public.notify_signup_created_confirmed()
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
    -- Never let a welcome-email notification break signup.
    return new;
end;
$$;

drop trigger if exists on_auth_user_created_confirmed on auth.users;
create trigger on_auth_user_created_confirmed
after insert on auth.users
for each row
when (new.email_confirmed_at is not null)
execute function public.notify_signup_created_confirmed();
