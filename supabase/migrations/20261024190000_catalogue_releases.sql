-- One row per published game-data release. The app reads the newest row and falls
-- back to the bundled data/catalogue.json if Supabase is unreachable.
create table if not exists public.catalogue_releases (
  id bigint generated always as identity primary key,
  released_at timestamptz not null default now(),
  notes text,
  data jsonb not null
);
alter table public.catalogue_releases enable row level security;
revoke all on table public.catalogue_releases from public, anon, authenticated;
grant select on table public.catalogue_releases to anon;
create policy public_read_only on public.catalogue_releases for select to anon using (true);
grant select, insert on table public.catalogue_releases to service_role;
