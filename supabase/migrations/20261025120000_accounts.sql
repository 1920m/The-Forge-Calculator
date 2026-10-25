-- Accounts (step 1 of the Forger page). Sign-in is Google or Discord through Supabase Auth.
-- Every user table is private to its owner: row-level security on, nothing for anon,
-- and authenticated users only reach their own rows.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (char_length(display_name) between 1 and 32 and display_name !~ '[<>[:cntrl:]]'),
  avatar_url text
    check (avatar_url is null or (char_length(avatar_url) <= 500 and avatar_url ~ '^https://')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- A profile is created on first sign-in from the provider's name and picture, cleaned up.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  name text;
  pic text;
begin
  name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'user_name'), ''),
    'Forger');
  name := btrim(left(regexp_replace(name, '[<>[:cntrl:]]', '', 'g'), 32));
  if name = '' then name := 'Forger'; end if;

  pic := new.raw_user_meta_data ->> 'avatar_url';
  if pic is null or pic !~ '^https://' or char_length(pic) > 500 then pic := null; end if;

  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, name, pic)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Players can delete their own account. Everything they saved goes with it (on delete cascade).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
