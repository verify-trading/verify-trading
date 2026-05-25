-- Add Pro fair-use accounting to Ask reservations.
-- Free remains capped at 5 UTC-day messages. Pro is capped at 20 UTC-day messages.

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
  v_daily_limit int;
  v_limit_reason text;
  v_next int;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select tier into v_tier from public.profiles where id = uid;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;

  v_daily_limit := case when v_tier = 'pro' then 20 else 5 end;
  v_limit_reason := case when v_tier = 'pro' then 'pro_fair_use_limit' else 'daily_limit' end;

  insert into public.usage_limits (user_id, usage_date, query_count)
  values (uid, v_day, 1)
  on conflict (user_id, usage_date) do update
    set query_count = public.usage_limits.query_count + 1
    where public.usage_limits.query_count < v_daily_limit
  returning query_count into v_next;

  if v_next is null then
    return jsonb_build_object(
      'ok', false,
      'reason', v_limit_reason,
      'tier', v_tier,
      'remaining', 0
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'tier', v_tier,
    'remaining', greatest(v_daily_limit - v_next, 0)
  );
end;
$$;

grant execute on function public.reserve_ask_query() to authenticated;
revoke execute on function public.reserve_ask_query() from public;
