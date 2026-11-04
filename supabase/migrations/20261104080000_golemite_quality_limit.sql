-- Golemites are crafted in the forge like weapons and armour: 10 to 50 ores, and the card shows craft quality.
alter table public.golemites
  add column quality smallint not null default 100 check (quality between 1 and 100),
  add constraint golemites_max_ores check (private.forge_ore_total(ores) <= 50);

grant insert (quality) on public.golemites to authenticated;

-- Shared profiles send the quality too.
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
      select jsonb_build_object('id', g.id, 'name', g.name, 'ores', g.ores, 'level', g.level, 'quality', g.quality, 'catalogue_revision', g.catalogue_revision)
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
