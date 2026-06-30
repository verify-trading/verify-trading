-- Migration 21 — production security hardening
--
-- Apply this on the production database (Supabase SQL editor or your migration
-- tooling). It is idempotent and safe to re-run. Three fixes:
--
--   1. [P0] Stop users from self-granting Pro by editing their own profiles.tier.
--   2. [P1] Stop exposing verified_entities (incl. internal_notes) over the API.
--   3. [P1] Add refund_ask_query() so a failed Ask returns the reserved daily query.
--
-- The application reads verified_entities / broker_entity_map and writes
-- profiles.tier exclusively through the service-role client (which bypasses RLS),
-- so none of these changes break the app.

-- ---------------------------------------------------------------------------
-- 1. Lock down privileged profile columns (tier, stripe_customer_id).
--    A logged-in end user (auth.uid() present) may never change these; only the
--    billing system via the service-role client (auth.uid() IS NULL) may.
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Service role / DB admin (no end-user JWT): allowed.
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.tier, 'free') is distinct from 'free'
       or new.stripe_customer_id is not null then
      raise exception 'profiles.tier / stripe_customer_id may only be set by the billing system';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.tier is distinct from old.tier
       or new.stripe_customer_id is distinct from old.stripe_customer_id then
      raise exception 'profiles.tier / stripe_customer_id may only be changed by the billing system';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_privileged_columns on public.profiles;
create trigger guard_profile_privileged_columns
before insert or update on public.profiles
for each row
execute function public.guard_profile_privileged_columns();

-- ---------------------------------------------------------------------------
-- 2. Remove the over-broad "any authenticated user can read everything" SELECT
--    policies. The app reads these tables only via the service role. This closes
--    direct PostgREST access to verified_entities.internal_notes (internal guru
--    suspicion notes) and the full entity table.
-- ---------------------------------------------------------------------------
drop policy if exists "verified_entities_read_authenticated" on public.verified_entities;
drop policy if exists "broker_entity_map_read_authenticated" on public.broker_entity_map;
-- RLS stays enabled (deny-all for anon/authenticated); service role is unaffected.

-- ---------------------------------------------------------------------------
-- 3. Refund a reserved daily Ask query when generation fails. Mirrors
--    reserve_ask_query: security invoker, keyed on auth.uid(), floored at 0.
-- ---------------------------------------------------------------------------
create or replace function public.refund_ask_query()
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  update public.usage_limits
    set query_count = greatest(0, query_count - 1)
    where user_id = auth.uid()
      and usage_date = (timezone('utc', now()))::date
      and query_count > 0;
end;
$$;

revoke execute on function public.refund_ask_query() from public;
grant execute on function public.refund_ask_query() to authenticated;
