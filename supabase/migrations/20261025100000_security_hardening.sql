-- Security hardening (25 Oct 2026).

-- 1. pg_net was left installed after a data import. While installed, the anon role could execute
--    net.http_get / net.http_post (outbound requests from the database). Not exposed through the API,
--    but nothing needs it, so remove it. Re-create it only for an import, and drop it straight after.
drop extension if exists pg_net;

-- 2. The public API could download every catalogue release ever published in one request (520 KB and
--    growing), an easy way to burn bandwidth. Visitors only need the newest release, so that is all anon
--    can read. The newest id comes from a function in a schema the API does not expose; a policy that
--    queried the same table directly would recurse.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.latest_catalogue_release_id()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$ select max(id) from public.catalogue_releases $$;

revoke all on function private.latest_catalogue_release_id() from public;
grant execute on function private.latest_catalogue_release_id() to anon, authenticated;

drop policy if exists public_read_only on public.catalogue_releases;
create policy public_read_latest on public.catalogue_releases
  for select to anon
  using (id = (select private.latest_catalogue_release_id()));
