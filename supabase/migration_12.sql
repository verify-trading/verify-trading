-- Reduce the free Ask quota to 5 UTC-day messages (atomic cap unchanged).
create or replace function public.reserve_ask_query()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_tier text;
  v_day date := (timezone('utc', now()))::date;
  v_current int;
  v_next int;
  v_free_daily_limit int := 5;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select tier into v_tier from public.profiles where id = uid;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;

  if v_tier = 'pro' then
    return jsonb_build_object('ok', true, 'tier', 'pro', 'remaining', null);
  end if;

  select query_count into v_current
  from public.usage_limits
  where user_id = uid and usage_date = v_day
  for update;

  if v_current is null then
    insert into public.usage_limits (user_id, usage_date, query_count)
    values (uid, v_day, 1);
    return jsonb_build_object('ok', true, 'tier', 'free', 'remaining', v_free_daily_limit - 1);
  end if;

  if v_current >= v_free_daily_limit then
    return jsonb_build_object(
      'ok', false,
      'reason', 'daily_limit',
      'tier', 'free',
      'remaining', 0
    );
  end if;

  v_next := v_current + 1;
  update public.usage_limits
  set query_count = v_next
  where user_id = uid and usage_date = v_day;

  return jsonb_build_object(
    'ok', true,
    'tier', 'free',
    'remaining', v_free_daily_limit - v_next
  );
end;
$$;

grant execute on function public.reserve_ask_query() to authenticated;
revoke execute on function public.reserve_ask_query() from public;
