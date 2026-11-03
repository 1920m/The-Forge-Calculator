-- The race a player plays, saved with their loadout (a slot under the pickaxe). Optional: old loadouts have none.
-- The site checks the id against its race list when it reads it.
alter table public.loadouts
  add column race text check (race ~ '^[a-z-]{1,30}$');

grant insert (race), update (race) on public.loadouts to authenticated;

-- Shared profiles show the race too.
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
  slot text;
  fid uuid;
  pick text;
  rc text;
begin
  if sid is null or sid !~ '^[a-f0-9]{12}$' then
    return null;
  end if;
  select id, display_name, avatar_url into p from public.profiles where share_id = sid;
  if not found then
    return null;
  end if;
  select helmet, chestplate, leggings, weapon, pickaxe, race into l from public.loadouts where user_id = p.id;
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
  end if;
  return jsonb_build_object(
    'name', p.display_name,
    'avatar_url', p.avatar_url,
    'slots', slots,
    'pickaxe', pick,
    'race', rc);
end;
$$;

revoke all on function public.get_shared_profile(text) from public;
grant execute on function public.get_shared_profile(text) to anon, authenticated;
