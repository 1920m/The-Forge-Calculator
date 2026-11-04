-- A tiny stand-in for the parts of Supabase the API migration uses, so it can be tested on plain Postgres:
-- the anon/authenticated roles, auth.users and auth.uid(), the extensions schema with pgcrypto, and the private schema.
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create schema extensions;
create extension pgcrypto schema extensions;
grant usage on schema extensions to anon, authenticated;
create schema private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;
grant usage on schema public to anon, authenticated;
insert into auth.users values ('c13e43d5-0051-47c7-84f3-db21d997f90f'), ('22222222-2222-4222-8222-222222222222');
