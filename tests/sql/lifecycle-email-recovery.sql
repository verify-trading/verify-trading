-- Run against a test database after migrations 35 and lifecycle_email_recovery:
-- psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/sql/lifecycle-email-recovery.sql
begin;

insert into auth.users (id, email, email_confirmed_at) values
  ('ee000000-0000-4000-8000-000000000001', 'confirmed@example.com', now()),
  ('ee000000-0000-4000-8000-000000000002', 'unconfirmed@example.com', null),
  ('ee000000-0000-4000-8000-000000000003', 'new@example.com', now()),
  ('ee000000-0000-4000-8000-000000000004', 'pro@example.com', now());

-- Real Supabase has the profile-creation trigger; the upsert also supports minimal local fixtures.
insert into public.profiles (id, display_name, created_at, signup_welcome_email_sent_at) values
  ('ee000000-0000-4000-8000-000000000001', 'Confirmed', now() - interval '30 hours', now() - interval '25 hours'),
  ('ee000000-0000-4000-8000-000000000002', 'Unconfirmed', now() - interval '30 hours', null),
  ('ee000000-0000-4000-8000-000000000003', 'New', now() - interval '2 hours', now() - interval '1 hour'),
  ('ee000000-0000-4000-8000-000000000004', 'Pro', now() - interval '30 hours', null)
on conflict (id) do update set created_at = excluded.created_at,
  signup_welcome_email_sent_at = excluded.signup_welcome_email_sent_at;

do $$
declare
  v_user uuid := 'ee000000-0000-4000-8000-000000000001';
  v_claim record;
  v_payload jsonb := '{"to":"confirmed@example.com","subject":"Original"}';
begin
  assert not exists (
    select 1 from public.lifecycle_user_facts(now() - interval '7 days')
    where user_id = 'ee000000-0000-4000-8000-000000000002'
  ), 'Unconfirmed addresses must not enter marketing';
  assert exists (
    select 1 from public.lifecycle_user_facts(now() - interval '7 days') f,
      jsonb_array_elements(f.sends) e
    where f.user_id = v_user and e->>'email_id' = 'e1' and e->>'kind' = 'transactional'
  ), 'The existing signup welcome must appear in send history';

  assert not exists (select 1 from public.claim_lifecycle_email(
    'ee000000-0000-4000-8000-000000000003', 'c1', 'c1', 'marketing', null,
    '{"to":"new@example.com"}'
  )), 'The welcome must block same-day C1';
  assert not exists (select 1 from public.claim_lifecycle_email(
    'ee000000-0000-4000-8000-000000000002', 'e2a', 'e2a', 'marketing', null,
    '{"to":"unconfirmed@example.com"}'
  )), 'The send boundary must reject unconfirmed addresses too';

  select * into strict v_claim from public.claim_lifecycle_email(v_user, 'e2a', 'e2a', 'marketing', null, v_payload);
  assert v_claim.status = 'sending', 'A new claim must lease the email';
  assert not exists (
    select 1 from public.lifecycle_user_facts(now() - interval '7 days') f,
      jsonb_array_elements(f.sends) e
    where f.user_id = v_user and e->>'email_id' = 'e2a'
  ), 'An incomplete claim must remain eligible for picker recovery';
  assert not exists (select 1 from public.claim_lifecycle_email(v_user, 'e2a', 'e2a', 'marketing', null, v_payload)),
    'A concurrent worker must not steal a live lease';
  assert not exists (select 1 from public.claim_lifecycle_email(v_user, 'c1', 'c1', 'marketing', null, v_payload)),
    'A changed pick must not bypass an unresolved send for the same user';

  update public.email_sends set processing_started_at = now() - interval '10 minutes',
    first_attempt_at = now() - interval '15 minutes' where id = v_claim.id;
  select * into strict v_claim from public.claim_lifecycle_email(
    v_user, 'e2a', 'e2a', 'marketing', null, '{"to":"confirmed@example.com","subject":"Changed"}'
  );
  assert v_claim.payload = v_payload, 'Recovery must preserve the original payload';
  assert v_claim.first_attempt_at = now() - interval '15 minutes', 'Recovery must preserve the idempotency window';

  update public.profiles set email_opt_out_at = now() where id = v_user;
  update public.email_sends set processing_started_at = now() - interval '10 minutes' where id = v_claim.id;
  assert not exists (select 1 from public.claim_lifecycle_email(v_user, 'e2a', 'e2a', 'marketing', null, v_payload)),
    'Recovery must respect a new opt-out';
  update public.profiles set email_opt_out_at = null where id = v_user;

  update public.email_sends set status = 'sent', resend_id = 're_test' where id = v_claim.id;
  select * into strict v_claim from public.claim_lifecycle_email(v_user, 'e2a', 'e2a', 'marketing', null, v_payload);
  assert v_claim.status = 'sent', 'A completed send must be distinguishable from an active lease';

  update public.email_sends set status = 'sending', processing_started_at = now() - interval '10 minutes',
    first_attempt_at = now() - interval '24 hours', resend_id = null where id = v_claim.id;
  select * into strict v_claim from public.claim_lifecycle_email(v_user, 'e2a', 'e2a', 'marketing', null, v_payload);
  assert v_claim.status = 'blocked', 'Ambiguous attempts must not replay after the idempotency window';

  assert not has_function_privilege('anon', 'public.claim_lifecycle_email(uuid,text,text,text,text,jsonb)', 'execute');
  assert not has_function_privilege('authenticated', 'public.claim_lifecycle_email(uuid,text,text,text,text,jsonb)', 'execute');
  assert not has_function_privilege('anon', 'public.lifecycle_user_facts(timestamptz)', 'execute');
  assert not has_function_privilege('authenticated', 'public.lifecycle_pending_subscription_welcomes(timestamptz,int)', 'execute');
  assert not has_table_privilege('anon', 'public.email_sends', 'select');
  assert not has_table_privilege('authenticated', 'public.email_sends', 'select');
  assert has_function_privilege('service_role', 'public.claim_lifecycle_email(uuid,text,text,text,text,jsonb)', 'execute');
end;
$$;

insert into public.billing_subscriptions
  (user_id, stripe_subscription_id, stripe_customer_id, status, created_at)
values
  ('ee000000-0000-4000-8000-000000000004', 'sub_recovery_active', 'cus_recovery', 'active', now()),
  ('ee000000-0000-4000-8000-000000000004', 'sub_recovery_incomplete', 'cus_recovery', 'incomplete', now());

do $$
declare
  v_user uuid := 'ee000000-0000-4000-8000-000000000004';
begin
  assert exists (select 1 from public.lifecycle_pending_subscription_welcomes(now() - interval '1 hour', 100)
    where stripe_subscription_id = 'sub_recovery_active'), 'Failed welcomes must remain discoverable without a webhook';
  assert not exists (select 1 from public.lifecycle_pending_subscription_welcomes(now() - interval '1 hour', 100)
    where stripe_subscription_id = 'sub_recovery_incomplete'), 'Unpaid incomplete subscriptions must not receive C5';

  insert into public.email_sends (user_id, email_id, dedupe_key, kind, status)
  values (v_user, 'c5', 'c5:sub_recovery_active', 'transactional', 'sent');
  assert exists (select 1 from public.lifecycle_pending_subscription_welcomes(now() - interval '1 hour', 100)
    where stripe_subscription_id = 'sub_recovery_active'), 'A completed send with a missing subscription stamp must be repairable';
  update public.email_sends set status = 'blocked' where user_id = v_user;
  assert not exists (select 1 from public.lifecycle_pending_subscription_welcomes(now() - interval '1 hour', 100)
    where stripe_subscription_id = 'sub_recovery_active'), 'Blocked welcomes must not starve other retries';
end;
$$;

set local role service_role;
do $$
begin
  assert exists (select 1 from public.lifecycle_user_facts(now() - interval '7 days'));
  assert not exists (select 1 from public.claim_lifecycle_email(
    'ee000000-0000-4000-8000-000000000002', 'e2a', 'e2a', 'marketing', null,
    '{"to":"unconfirmed@example.com"}'
  )), 'The actual service role can run the protected confirmation check';
  perform * from public.lifecycle_pending_subscription_welcomes(now() - interval '1 hour', 100);
end;
$$;
reset role;

rollback;
