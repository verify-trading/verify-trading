-- Members chat: continuous Pro entitlement + last-admin protection.
--
-- Before this, `is_pro` was only consulted by join_community_room (i.e. once, at
-- join time). Every later access check went through is_community_member, which
-- tested `status = 'active'` alone — so a member who cancelled Pro kept full read
-- and write access to the room indefinitely. Billing never touches
-- community_members, so nothing else revoked it.

-- Entitlement for the room, evaluated on every access.
--
-- Deliberately fails OPEN on internal inconsistency: access is granted when the
-- profile tier says pro OR a live subscription row exists. Both are written by the
-- same Stripe sync (refreshProfileBillingState), but that writes the subscription
-- rows first and the profile tier second — so a partial failure can leave a paying
-- member with tier='free'. Wrongly locking out a paying customer is worse than one
-- lingering ex-member, so access is only revoked when BOTH sources agree.
--
-- `past_due` is included (matching PRO_ACCESS_SUBSCRIPTION_STATUSES) so a single
-- failed card charge does not instantly eject someone mid-conversation, and a
-- cancel-at-period-end subscription stays `active` until the period actually ends.
create or replace function public.has_community_entitlement(p_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_pro(p_user) or exists (
    select 1 from public.billing_subscriptions s
    where s.user_id = p_user
      and s.status in ('active', 'trialing', 'past_due')
  );
$$;

-- Admins are exempt: moderation must keep working regardless of the moderator's
-- own subscription state.
create or replace function public.is_community_member(p_room uuid, p_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.community_members m
    where m.room_id = p_room
      and m.user_id = p_user
      and m.status = 'active'
      and (m.role = 'admin' or public.has_community_entitlement(m.user_id))
  );
$$;

-- Join uses the same entitlement definition, so the door and the room agree.
create or replace function public.join_community_room(p_slug text)
returns public.community_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.community_rooms;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  select * into v_room from public.community_rooms where slug = p_slug;
  if v_room.id is null then
    raise exception 'Room not found.' using errcode = 'P0002';
  end if;

  if not public.has_community_entitlement(v_uid) and not public.is_community_admin(v_room.id, v_uid) then
    raise exception 'Pro membership required.' using errcode = '42501';
  end if;

  -- Never re-activates a banned member.
  insert into public.community_members (room_id, user_id, role, status)
  values (v_room.id, v_uid, 'member', 'active')
  on conflict (room_id, user_id) do nothing;

  return v_room;
end;
$$;

-- A room must always retain at least one active admin. The UI blocks self-demotion,
-- but nothing stopped one admin demoting/banning another (or a direct delete)
-- leaving the room unadministrable without database access.
create or replace function public.community_members_protect_last_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_losing_admin boolean;
begin
  v_losing_admin := old.role = 'admin' and old.status = 'active' and (
    tg_op = 'DELETE' or new.role <> 'admin' or new.status <> 'active'
  );

  if v_losing_admin and not exists (
    select 1 from public.community_members m
    where m.room_id = old.room_id
      and m.user_id <> old.user_id
      and m.role = 'admin'
      and m.status = 'active'
  ) then
    raise exception 'This room must keep at least one admin.' using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists community_members_protect_last_admin_trg on public.community_members;
create trigger community_members_protect_last_admin_trg
before update or delete on public.community_members
for each row
execute function public.community_members_protect_last_admin();
