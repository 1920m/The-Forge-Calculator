-- Golemites: Golem companions forged from at least 10 ores. Private to their owner, like saved forges.
-- Only the inputs are stored (name, ores, growth level); the site works out rarity and traits from the game data.

-- Total ores in a valid ore list (check constraints can't hold a subquery, so it's a function).
create or replace function private.forge_ore_total(ores jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum((e ->> 'count')::int), 0)::int from jsonb_array_elements(ores) e;
$$;

revoke all on function private.forge_ore_total(jsonb) from public, anon;
grant execute on function private.forge_ore_total(jsonb) to authenticated;

create table public.golemites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40 and name !~ '[<>[:cntrl:]]' and name = btrim(name)),
  -- Same ore format as saved forges (1 to 4 ores, 1 to 99 each), and the Golemite forge needs 10 or more in all.
  ores jsonb not null check (
    private.valid_forge_ores(ores) and private.forge_ore_total(ores) >= 10
  ),
  -- Growth: one Golem Snack a day gives 1 level, up to 25.
  level smallint not null default 0 check (level between 0 and 25),
  catalogue_revision integer check (catalogue_revision between 0 and 1000000),
  created_at timestamptz not null default now()
);

create index golemites_user_created on public.golemites (user_id, created_at desc);

alter table public.golemites enable row level security;

revoke all on public.golemites from anon, authenticated, public;
grant select, delete on public.golemites to authenticated;
grant insert (name, ores, level, catalogue_revision) on public.golemites to authenticated;
grant update (name, level) on public.golemites to authenticated;

create policy golemites_select_own on public.golemites
  for select to authenticated using ((select auth.uid()) = user_id);
create policy golemites_insert_own on public.golemites
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy golemites_update_own on public.golemites
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy golemites_delete_own on public.golemites
  for delete to authenticated using ((select auth.uid()) = user_id);

-- At most 50 saved Golemites per player.
create or replace function private.limit_golemites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('golemites:' || new.user_id::text, 0));
  if (select count(*) from public.golemites where user_id = new.user_id) >= 50 then
    raise exception 'You can save up to 50 Golemites. Delete some to save more.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function private.limit_golemites() from public, anon, authenticated;

create trigger golemites_limit
  before insert on public.golemites
  for each row execute function private.limit_golemites();

-- The second Golem slot opens at level 300 in the game. Players say so themselves (we can't see their level).
alter table public.profiles
  add column golem_slot2 boolean not null default false;
grant update (golem_slot2) on public.profiles to authenticated;

-- Two Golem slots in the loadout. Deleting a Golemite empties its slot.
alter table public.loadouts
  add column golem1 uuid references public.golemites (id) on delete set null,
  add column golem2 uuid references public.golemites (id) on delete set null;
grant insert (golem1, golem2), update (golem1, golem2) on public.loadouts to authenticated;

-- Each Golem slot may only hold the player's own Golemite, not the same one twice, and slot 2 only once it's open.
create or replace function private.check_loadout_golems()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.golem1 is not null and not exists (select 1 from public.golemites where id = new.golem1 and user_id = new.user_id) then
    raise exception 'That Golemite is not in your saved Golemites.' using errcode = 'P0001';
  end if;
  if new.golem2 is not null then
    if not exists (select 1 from public.golemites where id = new.golem2 and user_id = new.user_id) then
      raise exception 'That Golemite is not in your saved Golemites.' using errcode = 'P0001';
    end if;
    if new.golem2 = new.golem1 then
      raise exception 'That Golemite is already in your other slot.' using errcode = 'P0001';
    end if;
    -- Only checked when slot 2 changes, so turning the setting off later doesn't block other loadout changes.
    if tg_op = 'INSERT' or new.golem2 is distinct from old.golem2 then
      if not coalesce((select golem_slot2 from public.profiles where id = new.user_id), false) then
        raise exception 'Your second Golem slot opens at level 300.' using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.check_loadout_golems() from public, anon, authenticated;

create trigger loadouts_check_golems
  before insert or update on public.loadouts
  for each row execute function private.check_loadout_golems();

-- Shared profiles show the equipped Golemites (the second only while that slot is open).
create or replace function public.get_shared_profile(sid text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p record;
  l record;
  forge jsonb;
  slots jsonb := '{}'::jsonb;
  golems jsonb := '{}'::jsonb;
  slot text;
  fid uuid;
  pick text;
  rc text;
begin
  if sid is null or sid !~ '^[a-f0-9]{12}$' then
    return null;
  end if;
  select id, display_name, avatar_url, golem_slot2 into p from public.profiles where share_id = sid;
  if not found then
    return null;
  end if;
  select helmet, chestplate, leggings, weapon, pickaxe, race, golem1, golem2 into l from public.loadouts where user_id = p.id;
  if found then
    pick := l.pickaxe;
    rc := l.race;
    foreach slot in array array['helmet', 'chestplate', 'leggings', 'weapon'] loop
      fid := case slot when 'helmet' then l.helmet when 'chestplate' then l.chestplate when 'leggings' then l.leggings else l.weapon end;
      continue when fid is null;
      select jsonb_build_object(
        'id', f.id, 'name', f.name, 'kind', f.kind, 'world', f.world, 'class_name', f.class_name,
        'variant_id', f.variant_id, 'quality', f.quality, 'ores', f.ores, 'catalogue_revision', f.catalogue_revision,
        'enhance', f.enhance, 'runes', f.runes)
        into forge
        from public.saved_forges f where f.id = fid and f.user_id = p.id;
      if forge is not null then
        slots := slots || jsonb_build_object(slot, forge);
      end if;
    end loop;
    foreach slot in array array['golem1', 'golem2'] loop
      fid := case slot when 'golem1' then l.golem1 else l.golem2 end;
      continue when fid is null or (slot = 'golem2' and not p.golem_slot2);
      forge := null;
      select jsonb_build_object('id', g.id, 'name', g.name, 'ores', g.ores, 'level', g.level, 'catalogue_revision', g.catalogue_revision)
        into forge
        from public.golemites g where g.id = fid and g.user_id = p.id;
      if forge is not null then
        golems := golems || jsonb_build_object(slot, forge);
      end if;
    end loop;
  end if;
  return jsonb_build_object(
    'name', p.display_name,
    'avatar_url', p.avatar_url,
    'slots', slots,
    'pickaxe', pick,
    'race', rc,
    'golems', golems,
    'golem_slot2', p.golem_slot2);
end;
$$;

revoke all on function public.get_shared_profile(text) from public;
grant execute on function public.get_shared_profile(text) to anon, authenticated;
