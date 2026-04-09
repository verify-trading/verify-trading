-- Username on profiles (unique when set). Extends handle_new_user to read signup metadata.

alter table public.profiles
  add column if not exists username text;

-- Case-insensitive uniqueness for non-null usernames
drop index if exists profiles_username_lower_key;
create unique index profiles_username_lower_key
  on public.profiles (lower(username))
  where username is not null and length(trim(username)) > 0;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_username text;
  meta_display text;
begin
  meta_username := nullif(lower(trim(new.raw_user_meta_data ->> 'username')), '');
  meta_display := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    nullif(split_part(new.email, '@', 1), '')
  );

  insert into public.profiles (id, display_name, username)
  values (new.id, meta_display, meta_username)
  on conflict (id) do nothing;

  return new;
end;
$$;
