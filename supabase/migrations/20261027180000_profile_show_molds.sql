-- Second player setting: show molds on the calculator (a fifth forge slot that aims the forge at one item).
-- Off unless the player turns it on in Settings.
alter table public.profiles
  add column show_molds boolean not null default false;

-- Players can already update their own profile row (policy profiles_update_own); this lets them change this column too.
grant update (show_molds) on public.profiles to authenticated;
