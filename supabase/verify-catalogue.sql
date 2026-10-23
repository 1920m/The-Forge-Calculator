-- Read-only security and completeness checks for the Forge project.
select c.relname as table_name, c.relrowsecurity as rls,
  has_table_privilege('anon',c.oid,'SELECT') as anon_select,
  has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as anon_write,
  has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as authenticated_access,
  (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname and p.cmd='SELECT' and p.roles=array['anon']::name[]) as anon_read_policies
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
order by c.relname;

begin;
set local role anon;
select 'ores' as dataset, count(*) from public.ores
union all select 'ore_traits',count(*) from public.ore_traits
union all select 'weapons',count(*) from public.weapons
union all select 'armour_pieces',count(*) from public.armour_pieces
union all select 'category_odds',count(*) from public.category_odds;
rollback;

select id,public,allowed_mime_types,file_size_limit from storage.buckets where id='forge-images';
select policyname,cmd,roles from pg_policies where schemaname='storage' and tablename='objects';
