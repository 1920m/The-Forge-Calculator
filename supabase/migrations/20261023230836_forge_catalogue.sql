-- New Forge Calculator project only. No authentication or public writes.
begin;

create table public.patches (
  id text primary key,
  version text not null,
  released_on date,
  notes text
);
create table public.ores (
  slug text primary key,
  name text not null unique,
  rarity text not null,
  multiplier numeric check (multiplier >= 0),
  multiplier_rule text not null default 'fixed' check (multiplier_rule in ('fixed', 'average-other-ores')),
  worlds smallint[] check (worlds <@ array[1,2,3,4]::smallint[] and cardinality(worlds) > 0),
  world_status text not null default 'unknown' check (world_status in ('confirmed','derived','assumed','unknown')),
  forgeable boolean,
  drop_one_in numeric check (drop_one_in > 0),
  image_path text,
  source_record jsonb not null default '{}'::jsonb
);
create table public.ore_traits (
  id text primary key,
  ore_slug text not null references public.ores(slug),
  applies_to text not null check (applies_to in ('weapon','armour','both','unknown')),
  effect_type text not null default 'unstructured',
  source_text text not null,
  params jsonb,
  -- Do not calculate effects from free text or invent parameters.
  parameter_status text not null default 'unknown' check (parameter_status in ('confirmed','derived','assumed','unknown'))
);
create index ore_traits_ore_slug_idx on public.ore_traits(ore_slug);
create table public.weapon_types (
  slug text primary key,
  name text not null unique,
  slot smallint check (slot between 1 and 7),
  lock_ore smallint check (lock_ore between 3 and 55),
  worlds smallint[] check (worlds <@ array[1,2,3,4]::smallint[] and cardinality(worlds) > 0)
);
create table public.weapons (
  slug text primary key,
  name text not null unique,
  type_slug text not null references public.weapon_types(slug),
  base_damage numeric check (base_damage > 0),
  index_speed_s numeric check (index_speed_s > 0),
  true_speed_s numeric check (true_speed_s > 0),
  range_studs numeric check (range_studs > 0),
  base_price numeric check (base_price >= 0),
  chance_one_in numeric check (chance_one_in > 0),
  worlds smallint[] check (worlds <@ array[1,2,3,4]::smallint[] and cardinality(worlds) > 0),
  world_status text not null default 'unknown' check (world_status in ('confirmed','derived','assumed','unknown')),
  image_path text
);
create index weapons_type_slug_idx on public.weapons(type_slug);
create table public.armour_variants (
  slug text primary key,
  name text not null,
  class text not null check (class in ('Light','Medium','Heavy')),
  weight_one_in numeric check (weight_one_in > 0),
  worlds smallint[] check (worlds <@ array[1,2,3,4]::smallint[] and cardinality(worlds) > 0),
  world_status text not null default 'unknown' check (world_status in ('confirmed','derived','assumed','unknown'))
);
create table public.armour_pieces (
  slug text primary key,
  name text not null unique,
  variant_slug text not null references public.armour_variants(slug),
  slot text not null check (slot in ('helmet','chestplate','leggings')),
  vitality_pct numeric check (vitality_pct > 0),
  base_defence numeric check (base_defence > 0),
  base_price numeric check (base_price >= 0),
  chance_one_in numeric check (chance_one_in > 0),
  source_chance_one_in numeric check (source_chance_one_in > 0),
  image_path text
);
create index armour_pieces_variant_slug_idx on public.armour_pieces(variant_slug);
create table public.category_odds (
  item_kind text not null check (item_kind in ('weapon','armour')),
  ore_count smallint not null check (ore_count between 3 and 55),
  slot smallint not null,
  probability numeric not null check (probability between 0 and 100),
  row_total numeric not null,
  primary key (item_kind, ore_count, slot),
  check (slot between 1 and case when item_kind = 'weapon' then 7 else 9 end)
);
create table public.enhancement_levels (
  level smallint primary key check (level between 0 and 10),
  all_stats_multiplier numeric not null check (all_stats_multiplier between 1 and 1.5)
  -- Success chances, costs and rune effects are outside v1.
);
create table public.quality_tiers (
  slug text primary key,
  name text not null,
  min_quality numeric not null check (min_quality between 0 and 1),
  max_quality numeric not null check (max_quality between min_quality and 1)
);
create table public.trait_strength (
  share_pct smallint primary key check (share_pct between 0 and 100),
  strength numeric not null check (strength between 0 and 1)
);

-- A small, explicit table allowlist avoids changing unrelated database objects.
do $security$
declare table_name text;
begin
  foreach table_name in array array['patches','ores','ore_traits','weapon_types','weapons','armour_variants','armour_pieces','category_odds','enhancement_levels','quality_tiers','trait_strength'] loop
    execute format('alter table public.%I add column confidence text not null default ''unknown'' check (confidence in (''confirmed'',''derived'',''assumed'',''unknown''))', table_name);
    execute format('alter table public.%I add column source_url text not null', table_name);
    execute format('alter table public.%I add column patch_id text references public.patches(id)', table_name);
    execute format('alter table public.%I add column updated_at timestamptz not null default now()', table_name);
    execute format('create index %I on public.%I(patch_id)', table_name || '_patch_id_idx', table_name);
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select on table public.%I to anon', table_name);
    execute format('create policy public_read_only on public.%I for select to anon using (true)', table_name);
  end loop;
end
$security$;

-- Public game images only; no public upload/update/delete policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('forge-images', 'forge-images', true, 5242880, array['image/png','image/jpeg','image/webp','image/avif']);

commit;
