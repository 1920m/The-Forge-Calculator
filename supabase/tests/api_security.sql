-- Tests for the public API migration, run on plain Postgres with supabase-stub.sql (see run-api-tests.sh).
-- Each block raises an error on failure, so psql -v ON_ERROR_STOP=1 stops at the first one.

\set admin '''c13e43d5-0051-47c7-84f3-db21d997f90f'''
\set other '''22222222-2222-4222-8222-222222222222'''

create or replace function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
$$;
create or replace function pg_temp.must_fail(sql text, expect text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FAILED: expected an error (%) from: %', expect, sql;
exception when others then
  if sqlerrm like 'FAILED:%' then raise; end if;
  if position(expect in sqlerrm) = 0 and sqlstate <> expect then raise exception 'FAILED: % gave "%" (%), expected %', sql, sqlerrm, sqlstate, expect; end if;
end $$;
create or replace function pg_temp.ip(n int) returns text language sql as $$ select encode(extensions.digest('ip' || n, 'sha256'), 'hex') $$;
create or replace function pg_temp.h(k text) returns text language sql as $$ select encode(extensions.digest(k, 'sha256'), 'hex') $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- 1. Nobody but the database owner can read the private tables.
set role anon;
select pg_temp.must_fail('select * from private.api_keys', 'permission denied');
select pg_temp.must_fail('select * from private.api_requests', 'permission denied');
select pg_temp.must_fail('select public.api_admin_list_keys()', 'permission denied');
select pg_temp.must_fail('select public.api_admin_create_key(''x'', array[''catalogue:read''])', 'permission denied');
reset role;

-- 2. A signed-in account that isn't the admin (even one called 1920m) can't manage keys.
select pg_temp.as_user(:other);
set role authenticated;
select pg_temp.must_fail('select * from private.api_keys', 'permission denied');
do $$ begin if public.api_admin_check() then raise exception 'FAILED: non-admin is admin'; end if; end $$;
select pg_temp.must_fail('select public.api_admin_create_key(''x'', array[''catalogue:read''])', '42501');
select pg_temp.must_fail('select * from public.api_admin_list_keys()', '42501');
select pg_temp.must_fail('select public.api_admin_stats()', '42501');
select pg_temp.must_fail('select public.api_admin_set_settings(true)', '42501');
reset role;

-- 3. The admin (by account ID) creates keys; only the hash is stored.
select pg_temp.as_user(:admin);
set role authenticated;
do $$ begin if not public.api_admin_check() then raise exception 'FAILED: admin not recognised'; end if; end $$;
create temp table keys (name text primary key, id uuid, secret text);
grant all on keys to authenticated, anon;
insert into keys select 'bot', (r->>'id')::uuid, r->>'key' from (select public.api_admin_create_key('Discord bot', array['catalogue:read', 'calculator:execute', 'catalogue:read']) r) x;
insert into keys select 'cat', (r->>'id')::uuid, r->>'key' from (select public.api_admin_create_key('Catalogue only', array['catalogue:read']) r) x;
insert into keys select 'slow', (r->>'id')::uuid, r->>'key' from (select public.api_admin_create_key('Slow', array['calculator:execute'], null, 60, 3) r) x;
insert into keys select 'race', (r->>'id')::uuid, r->>'key' from (select public.api_admin_create_key('Race', array['calculator:execute'], null, 60, 100) r) x;
insert into keys select 'old', (r->>'id')::uuid, r->>'key' from (select public.api_admin_create_key('Rotate me', array['catalogue:read']) r) x;
select pg_temp.must_fail('select public.api_admin_create_key(''bad'', array[''admin:all''])', 'check');
select pg_temp.must_fail('select public.api_admin_create_key(''late'', array[''catalogue:read''], now() - interval ''1 day'')', 'future');
do $$ declare n int; begin
  select count(*) into n from public.api_admin_list_keys() where label = 'Discord bot' and scopes = array['calculator:execute', 'catalogue:read'];
  if n <> 1 then raise exception 'FAILED: list/scopes'; end if;
end $$;
reset role;
do $$ declare bad int; begin
  select count(*) into bad from keys where secret !~ '^fc_live_[A-Za-z0-9_-]{43}$';
  if bad > 0 then raise exception 'FAILED: key format'; end if;
  select count(*) into bad from keys k join private.api_keys a on a.id = k.id
   where a.key_hash <> encode(extensions.digest(k.secret, 'sha256'), 'hex') or a.prefix <> left(k.secret, 12);
  if bad > 0 then raise exception 'FAILED: stored hash/prefix'; end if;
  if exists (select 1 from private.api_keys a join keys k on a.key_hash = k.secret or a.prefix = k.secret) then raise exception 'FAILED: plaintext stored'; end if;
  if (select count(distinct secret) from keys) <> 5 then raise exception 'FAILED: keys not unique'; end if;
end $$;
-- The list never has hashes or secrets.
do $$ begin
  if exists (select 1 from information_schema.routines r join information_schema.parameters p on p.specific_name = r.specific_name
             where r.routine_name = 'api_admin_list_keys' and p.parameter_name in ('key_hash', 'key')) then raise exception 'FAILED: list exposes hash'; end if;
end $$;

-- 4. Requests: valid key, wrong key, scope, missing key.
set role anon;
do $$ declare r jsonb; begin
  r := public.api_authorize(pg_temp.h((select secret from keys where name = 'bot')), 'calculator:execute', pg_temp.ip(1));
  if not (r->>'ok')::boolean or (r->>'limit')::int <> 120 or (r->>'log_id') is null then raise exception 'FAILED: valid key %', r; end if;
  r := public.api_authorize(pg_temp.h('fc_live_' || repeat('x', 43)), 'catalogue:read', pg_temp.ip(2));
  if r->>'code' <> 'INVALID_API_KEY' or (r->>'status')::int <> 401 then raise exception 'FAILED: wrong key %', r; end if;
  r := public.api_authorize(pg_temp.h((select secret from keys where name = 'cat')), 'calculator:execute', pg_temp.ip(1));
  if r->>'code' <> 'INSUFFICIENT_SCOPE' or (r->>'status')::int <> 403 then raise exception 'FAILED: scope %', r; end if;
  r := public.api_authorize(null, 'catalogue:read', pg_temp.ip(1));
  if r->>'code' <> 'MISSING_API_KEY' then raise exception 'FAILED: anonymous catalogue should be off %', r; end if;
  r := public.api_authorize('not-a-hash', 'catalogue:read', pg_temp.ip(1));
  if r->>'code' <> 'BAD_REQUEST' then raise exception 'FAILED: bad hash %', r; end if;
  r := public.api_authorize(pg_temp.h((select secret from keys where name = 'bot')), 'admin', pg_temp.ip(1));
  if r->>'code' <> 'BAD_REQUEST' then raise exception 'FAILED: bad scope %', r; end if;
end $$;

-- 5. Twenty wrong keys from one IP lock it out for 10 minutes; other IPs are fine.
do $$ declare r jsonb; begin
  for i in 1..19 loop perform public.api_authorize(pg_temp.h('guess' || i), 'catalogue:read', pg_temp.ip(3)); end loop;
  r := public.api_authorize(pg_temp.h((select secret from keys where name = 'bot')), 'catalogue:read', pg_temp.ip(3));
  if not (r->>'ok')::boolean then raise exception 'FAILED: locked out too early %', r; end if;
  perform public.api_authorize(pg_temp.h('guess20'), 'catalogue:read', pg_temp.ip(3));
  r := public.api_authorize(pg_temp.h((select secret from keys where name = 'bot')), 'catalogue:read', pg_temp.ip(3));
  if r->>'code' <> 'TOO_MANY_INVALID_KEYS' or (r->>'retry_after')::int <> 600 then raise exception 'FAILED: lock-out %', r; end if;
  r := public.api_authorize(pg_temp.h((select secret from keys where name = 'bot')), 'catalogue:read', pg_temp.ip(4));
  if not (r->>'ok')::boolean then raise exception 'FAILED: other IP blocked %', r; end if;
end $$;

-- 6. Rate limit: the 4th request in a minute on a 3-per-minute key is refused, with Retry-After; scopes count separately.
do $$ declare r jsonb; begin
  for i in 1..3 loop
    r := public.api_authorize(pg_temp.h((select secret from keys where name = 'slow')), 'calculator:execute', pg_temp.ip(5));
    if not (r->>'ok')::boolean or (r->>'remaining')::int <> 3 - i then raise exception 'FAILED: rate % %', i, r; end if;
  end loop;
  r := public.api_authorize(pg_temp.h((select secret from keys where name = 'slow')), 'calculator:execute', pg_temp.ip(5));
  if r->>'code' <> 'RATE_LIMITED' or (r->>'retry_after')::int not between 1 and 60 then raise exception 'FAILED: limit %', r; end if;
end $$;

-- 7. The log row can only be finished once, with its own token.
do $$ declare r jsonb; st int; begin
  r := public.api_authorize(pg_temp.h((select secret from keys where name = 'bot')), 'catalogue:read', pg_temp.ip(6));
  perform public.api_finish((r->>'log_id')::bigint, 'wrong-token', 200, 5, null);
  perform public.api_finish((r->>'log_id')::bigint, r->>'log_token', 200, 12, null);
  perform public.api_finish((r->>'log_id')::bigint, r->>'log_token', 500, 99, 'INTERNAL_ERROR');
  reset role;
  select status into st from private.api_requests where id = (r->>'log_id')::bigint;
  if st <> 200 then raise exception 'FAILED: finish % ', st; end if;
  set role anon;
end $$;
reset role;

-- 8. Revoke, expiry and rotation with overlap.
select pg_temp.as_user(:admin);
set role authenticated;
select public.api_admin_revoke_key((select id from keys where name = 'cat'));
insert into keys select 'new', (r->>'id')::uuid, r->>'key' from (select public.api_admin_rotate_key((select id from keys where name = 'old'), 24) r) x;
select pg_temp.must_fail('select public.api_admin_rotate_key((select id from keys where name = ''cat''), 24)', 'No active key');
select pg_temp.must_fail('select public.api_admin_rotate_key((select id from keys where name = ''new''), 500)', 'Overlap');
reset role;
set role anon;
do $$ declare r jsonb; begin
  r := public.api_authorize(pg_temp.h((select secret from keys where name = 'cat')), 'catalogue:read', pg_temp.ip(7));
  if r->>'code' <> 'API_KEY_REVOKED' then raise exception 'FAILED: revoked %', r; end if;
  r := public.api_authorize(pg_temp.h((select secret from keys where name = 'old')), 'catalogue:read', pg_temp.ip(7));
  if not (r->>'ok')::boolean then raise exception 'FAILED: old key should still work during overlap %', r; end if;
  r := public.api_authorize(pg_temp.h((select secret from keys where name = 'new')), 'catalogue:read', pg_temp.ip(7));
  if not (r->>'ok')::boolean then raise exception 'FAILED: rotated key %', r; end if;
end $$;
reset role;
update private.api_keys set expires_at = now() - interval '1 second' where id = (select id from keys where name = 'old');
set role anon;
do $$ declare r jsonb; begin
  r := public.api_authorize(pg_temp.h((select secret from keys where name = 'old')), 'catalogue:read', pg_temp.ip(7));
  if r->>'code' <> 'API_KEY_EXPIRED' then raise exception 'FAILED: expired %', r; end if;
end $$;
reset role;

-- 9. Anonymous catalogue reads, only when the admin turns them on, and never for the calculator.
select pg_temp.as_user(:admin);
set role authenticated;
select public.api_admin_set_settings(true, 2);
reset role;
set role anon;
do $$ declare r jsonb; begin
  r := public.api_authorize(null, 'catalogue:read', pg_temp.ip(8));
  if not (r->>'ok')::boolean or (r->>'limit')::int <> 2 then raise exception 'FAILED: anonymous on %', r; end if;
  r := public.api_authorize(null, 'calculator:execute', pg_temp.ip(8));
  if r->>'code' <> 'MISSING_API_KEY' then raise exception 'FAILED: anonymous calculator %', r; end if;
end $$;
reset role;
select pg_temp.as_user(:admin);
set role authenticated;
select public.api_admin_set_settings(false);
do $$ declare s jsonb; begin
  s := public.api_admin_stats();
  if (s->>'total_30d')::int < 10 or (s->>'active_keys')::int < 3 or jsonb_array_length(s->'recent') = 0 then raise exception 'FAILED: stats %', s; end if;
  if s::text ~ 'fc_live_[A-Za-z0-9_-]{43}' or s::text like '%key_hash%' then raise exception 'FAILED: stats leak'; end if;
end $$;
reset role;

-- 10. Clean-up removes only old rows from its three tables, at most every 10 minutes.
insert into private.api_rate values ('key:x', 'catalogue:read', now() - interval '11 minutes', 5), ('key:x', 'catalogue:read', date_trunc('minute', now()) + interval '1 hour', 1);
insert into private.api_ip_failures values ('aa', now() - interval '61 minutes', 3), ('bb', now() - interval '5 minutes', 1);
insert into private.api_requests (at, endpoint, status) values (now() - interval '31 days', 'catalogue', 200), (now() - interval '29 days', 'catalogue', 200);
insert into private.api_requests (at, endpoint, token) values (now() - interval '6 minutes', 'calculate', 'abc');
update private.api_settings set last_cleanup = now() - interval '11 minutes';
set role anon;
select public.api_authorize(null, 'catalogue:read', pg_temp.ip(9));
reset role;
do $$ begin
  if exists (select 1 from private.api_rate where window_start < now() - interval '10 minutes') then raise exception 'FAILED: old rate rows'; end if;
  if not exists (select 1 from private.api_rate where bucket = 'key:x') then raise exception 'FAILED: new rate row removed'; end if;
  if exists (select 1 from private.api_ip_failures where ip_hash = 'aa') or not exists (select 1 from private.api_ip_failures where ip_hash = 'bb') then raise exception 'FAILED: ip failures'; end if;
  if exists (select 1 from private.api_requests where at < now() - interval '30 days') then raise exception 'FAILED: old log rows'; end if;
  if not exists (select 1 from private.api_requests where at between now() - interval '30 days' and now() - interval '28 days') then raise exception 'FAILED: recent log removed'; end if;
  if exists (select 1 from private.api_requests where token = 'abc') then raise exception 'FAILED: stale row not closed'; end if;
  if (select count(*) from auth.users) <> 2 then raise exception 'FAILED: users touched'; end if;
end $$;
-- A second run straight after does nothing (the 10-minute guard).
insert into private.api_requests (at, endpoint, status) values (now() - interval '40 days', 'catalogue', 200);
set role anon;
select public.api_authorize(null, 'catalogue:read', pg_temp.ip(9));
reset role;
do $$ begin
  if not exists (select 1 from private.api_requests where at < now() - interval '39 days') then raise exception 'FAILED: clean-up ran twice in 10 minutes'; end if;
end $$;

\echo API SECURITY TESTS PASSED
