-- Saved forges can keep their runes: the enhancement level (which decides how many rune slots are open) and the
-- runes in the calculator's link format, e.g. "blast-chip:3:atk_speed.crit_chance,-,flame-spark:1".
-- Both are optional, so older saves keep working. The site re-checks the runes against its rune list when it reads them.

alter table public.saved_forges
  add column enhance smallint check (enhance between 0 and 10),
  add column runes text check (char_length(runes) <= 300 and runes ~ '^[a-z0-9_.:,-]+$');

grant insert (enhance, runes) on public.saved_forges to authenticated;

-- Shared profiles show the loadout's DPS with runes too, so return the two new fields.
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
begin
  if sid is null or sid !~ '^[a-f0-9]{12}$' then
    return null;
  end if;
  select id, display_name, avatar_url into p from public.profiles where share_id = sid;
  if not found then
    return null;
  end if;
  select helmet, chestplate, leggings, weapon, pickaxe into l from public.loadouts where user_id = p.id;
  if found then
    pick := l.pickaxe;
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
    'pickaxe', pick);
end;
$$;

revoke all on function public.get_shared_profile(text) from public;
grant execute on function public.get_shared_profile(text) to anon, authenticated;
