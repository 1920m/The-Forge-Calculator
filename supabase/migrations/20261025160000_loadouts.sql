-- Loadout on the Forger page: one per player. Armour and weapon slots point at the player's own saved forges;
-- the pickaxe is picked from a list. Deleting a saved forge empties its slot.

create table public.loadouts (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  helmet uuid references public.saved_forges (id) on delete set null,
  chestplate uuid references public.saved_forges (id) on delete set null,
  leggings uuid references public.saved_forges (id) on delete set null,
  weapon uuid references public.saved_forges (id) on delete set null,
  pickaxe text check (pickaxe ~ '^[a-z0-9-]{1,40}$'),
  updated_at timestamptz not null default now()
);

alter table public.loadouts enable row level security;

revoke all on public.loadouts from anon, authenticated, public;
grant select, delete on public.loadouts to authenticated;
grant insert (helmet, chestplate, leggings, weapon, pickaxe) on public.loadouts to authenticated;
grant update (helmet, chestplate, leggings, weapon, pickaxe) on public.loadouts to authenticated;

create policy loadouts_select_own on public.loadouts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy loadouts_insert_own on public.loadouts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy loadouts_update_own on public.loadouts
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy loadouts_delete_own on public.loadouts
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Each slot may only hold the player's own forge of the right kind. (A foreign key alone would accept
-- another player's forge id, because key checks ignore row-level security.)
create or replace function private.check_loadout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  slot text;
  forge_id uuid;
  f record;
begin
  foreach slot in array array['helmet', 'chestplate', 'leggings', 'weapon'] loop
    forge_id := case slot when 'helmet' then new.helmet when 'chestplate' then new.chestplate when 'leggings' then new.leggings else new.weapon end;
    continue when forge_id is null;
    select kind, class_name into f from public.saved_forges where id = forge_id and user_id = new.user_id;
    if not found then
      raise exception 'That forge is not in your saved forges.' using errcode = 'P0001';
    end if;
    if (slot = 'weapon' and f.kind <> 'weapon')
       or (slot <> 'weapon' and (f.kind <> 'armour' or lower(f.class_name) not like ('% ' || slot))) then
      raise exception 'That forge does not fit the % slot.', slot using errcode = 'P0001';
    end if;
  end loop;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.check_loadout() from public, anon, authenticated;

create trigger loadouts_check
  before insert or update on public.loadouts
  for each row execute function private.check_loadout();
