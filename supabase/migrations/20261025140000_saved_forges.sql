-- Saved forges: the star on the calculator. Private to their owner.
-- Only the inputs are stored (ores, kind, world, class, variant, quality); the site works the stats out again
-- from the current game data, so a save never shows stale numbers.

-- Ores: [{"id":"kitsunite","count":20}, ...] with 1 to 4 different ores and whole counts from 1 to 99.
create or replace function private.valid_forge_ores(ores jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(ores) = 'array'
    and jsonb_array_length(ores) between 1 and 4
    and not exists (
      select 1 from jsonb_array_elements(ores) e
      where jsonb_typeof(e) <> 'object'
         or (select count(*) from jsonb_object_keys(e)) <> 2
         or jsonb_typeof(e -> 'id') is distinct from 'string'
         or jsonb_typeof(e -> 'count') is distinct from 'number'
         or coalesce((e ->> 'id') !~ '^[a-z0-9-]{1,40}$', true)
         or case when (e ->> 'count') ~ '^[0-9]{1,2}$' then (e ->> 'count')::int not between 1 and 99 else true end
    )
    and (select count(distinct e ->> 'id') from jsonb_array_elements(ores) e) = jsonb_array_length(ores);
$$;

revoke all on function private.valid_forge_ores(jsonb) from public, anon;
grant execute on function private.valid_forge_ores(jsonb) to authenticated;

create table public.saved_forges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40 and name !~ '[<>[:cntrl:]]' and name = btrim(name)),
  kind text not null check (kind in ('weapon', 'armour')),
  world smallint not null check (world between 1 and 4),
  class_name text not null check (char_length(class_name) between 1 and 60 and class_name ~ '^[A-Za-z'' -]+$'),
  variant_id text not null check (variant_id ~ '^[a-z0-9-]{1,60}$'),
  quality smallint not null check (quality between 1 and 100),
  ores jsonb not null check (private.valid_forge_ores(ores)),
  catalogue_revision integer check (catalogue_revision between 0 and 1000000),
  created_at timestamptz not null default now()
);

create index saved_forges_user_created on public.saved_forges (user_id, created_at desc);

alter table public.saved_forges enable row level security;

revoke all on public.saved_forges from anon, authenticated, public;
grant select, delete on public.saved_forges to authenticated;
grant insert (name, kind, world, class_name, variant_id, quality, ores, catalogue_revision) on public.saved_forges to authenticated;
grant update (name) on public.saved_forges to authenticated;

create policy saved_forges_select_own on public.saved_forges
  for select to authenticated using ((select auth.uid()) = user_id);
create policy saved_forges_insert_own on public.saved_forges
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy saved_forges_update_own on public.saved_forges
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy saved_forges_delete_own on public.saved_forges
  for delete to authenticated using ((select auth.uid()) = user_id);

-- At most 200 saved forges per player. The lock stops two quick saves from both slipping past the limit.
create or replace function private.limit_saved_forges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('saved_forges:' || new.user_id::text, 0));
  if (select count(*) from public.saved_forges where user_id = new.user_id) >= 200 then
    raise exception 'You can save up to 200 forges. Delete some to save more.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function private.limit_saved_forges() from public, anon, authenticated;

create trigger saved_forges_limit
  before insert on public.saved_forges
  for each row execute function private.limit_saved_forges();
