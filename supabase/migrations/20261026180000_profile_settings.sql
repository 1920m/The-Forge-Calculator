-- Player settings, remembered on their profile. The first one: show the "Hit a DPS target" panel on the calculator.
-- Off unless the player turns it on in Settings.
alter table public.profiles
  add column show_dps_target boolean not null default false;

-- Players already can update their own profile row (policy profiles_update_own); this lets them change this column too.
grant update (show_dps_target) on public.profiles to authenticated;
