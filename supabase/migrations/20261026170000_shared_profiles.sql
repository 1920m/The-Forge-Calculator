-- Shared profiles: a player can share a read-only link to their name, picture and loadout.
-- Off by default. Turning it on makes a random link id; turning it off deletes the id, so the old link stops working
-- (turning it on again makes a new one). Saved forges that aren't in the loadout stay private.

alter table public.profiles
  add column share_id text unique check (share_id ~ '^[a-f0-9]{12}$');

-- Players can't write share_id directly (the update grant is only on display_name); they go through this.
create or replace function public.set_profile_sharing(enabled boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid text;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if enabled then
    select share_id into sid from public.profiles where id = uid;
    if sid is null then
      -- 48 random bits from a UUID: far too many to guess.
      sid := left(replace(gen_random_uuid()::text, '-', ''), 12);
      update public.profiles set share_id = sid where id = uid;
    end if;
    return sid;
  end if;
  update public.profiles set share_id = null where id = uid;
  return null;
end;
$$;

revoke all on function public.set_profile_sharing(boolean) from public, anon;
grant execute on function public.set_profile_sharing(boolean) to authenticated;

-- What a shared link shows: the display name, picture and the loadout's forges (inputs only; the site works the
-- stats out). Nothing else about the player: no account id, email, other saved forges or dates.
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
        'variant_id', f.variant_id, 'quality', f.quality, 'ores', f.ores, 'catalogue_revision', f.catalogue_revision)
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
