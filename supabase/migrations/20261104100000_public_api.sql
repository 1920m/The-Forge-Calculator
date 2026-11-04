-- Public API (v1): API keys, shared rate limits, usage log and the admin list.
--
-- Everything lives in the `private` schema, which the Supabase REST API doesn't expose, and no role can read the
-- tables directly. The website's server reaches them only through the functions below:
--   api_authorize / api_finish   – called by the API routes (anon role) for each request
--   api_admin_*                  – called by the admin dashboard (signed in), and only work for the admin account
-- Keys are 256-bit random secrets; only their SHA-256 hash is stored. The plaintext is returned once, at creation.

-- ---------------------------------------------------------------- tables

create table private.api_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);

create table private.api_settings (
  id boolean primary key default true check (id), -- a single row
  anonymous_catalogue boolean not null default false,
  anonymous_catalogue_rpm integer not null default 30 check (anonymous_catalogue_rpm between 1 and 10000),
  last_cleanup timestamptz not null default now()
);
insert into private.api_settings default values;

create table private.api_keys (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 60 and label !~ '[<>[:cntrl:]]' and label = btrim(label)),
  -- Shown in lists so a key can be recognised ("fc_live_AbCd…"); never enough to use it.
  prefix text not null check (prefix ~ '^fc_live_[A-Za-z0-9_-]{4}$'),
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  scopes text[] not null check (scopes <@ array['catalogue:read', 'calculator:execute']::text[] and cardinality(scopes) between 1 and 2),
  catalogue_rpm integer not null default 60 check (catalogue_rpm between 1 and 10000),
  calculator_rpm integer not null default 120 check (calculator_rpm between 1 and 10000),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  replaced_by uuid references private.api_keys (id) on delete set null
);

-- Fixed one-minute windows per key (or per hashed IP for anonymous catalogue reads) and scope.
create table private.api_rate (
  bucket text not null,
  scope text not null,
  window_start timestamptz not null,
  hits integer not null,
  primary key (bucket, scope, window_start)
);

-- Wrong keys per hashed IP, in ten-minute windows: too many and that IP is refused for a while.
create table private.api_ip_failures (
  ip_hash text not null,
  window_start timestamptz not null,
  failures integer not null,
  primary key (ip_hash, window_start)
);

-- One row per request that reached the database. No keys, bodies, IPs or user data.
create table private.api_requests (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  key_id uuid references private.api_keys (id) on delete set null,
  endpoint text not null check (endpoint in ('catalogue', 'calculate')),
  status smallint,
  error_code text check (error_code ~ '^[A-Z_]{1,40}$'),
  latency_ms integer check (latency_ms between 0 and 600000),
  token text,       -- lets the API route finish its own row once; cleared when finished
  finished boolean not null default false
);
create index api_requests_at on private.api_requests (at desc);
create index api_requests_key_at on private.api_requests (key_id, at desc);

alter table private.api_admins enable row level security;
alter table private.api_settings enable row level security;
alter table private.api_keys enable row level security;
alter table private.api_rate enable row level security;
alter table private.api_ip_failures enable row level security;
alter table private.api_requests enable row level security;
revoke all on private.api_admins, private.api_settings, private.api_keys, private.api_rate, private.api_ip_failures, private.api_requests
  from public, anon, authenticated;

-- The site's administrator (display name 1920m; confirmed by the owner on 4 Nov 2026). Matched by account ID only.
insert into private.api_admins (user_id)
select id from auth.users where id = 'c13e43d5-0051-47c7-84f3-db21d997f90f';

-- ---------------------------------------------------------------- helpers

create or replace function private.is_api_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.api_admins where user_id = (select auth.uid()));
$$;
revoke all on function private.is_api_admin() from public, anon, authenticated;

-- Old rows go: rate windows after 10 minutes, IP failures after an hour, request log after 30 days.
-- Runs at most every 10 minutes (the settings row is the lock), from inside api_authorize.
create or replace function private.api_cleanup()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.api_settings set last_cleanup = now() where id and last_cleanup < now() - interval '10 minutes';
  if not found then
    return;
  end if;
  delete from private.api_rate where window_start < now() - interval '10 minutes';
  delete from private.api_ip_failures where window_start < now() - interval '1 hour';
  delete from private.api_requests where at < now() - interval '30 days';
  -- Rows whose route never finished them (crashed or timed out) are closed after 5 minutes.
  update private.api_requests set finished = true, token = null where not finished and at < now() - interval '5 minutes';
end;
$$;
revoke all on function private.api_cleanup() from public, anon, authenticated;

create or replace function private.new_api_key()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'fc_live_' || rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
$$;
revoke all on function private.new_api_key() from public, anon, authenticated;

-- ---------------------------------------------------------------- per request

-- Checks a request in one step: IP lock-out, key, revocation, expiry, scope and the rate limit (an atomic counter
-- shared by every server), then opens a log row. The API route sends the SHA-256 of the key it received (never the
-- key) and a hash of the caller's IP.
create or replace function public.api_authorize(p_key_hash text, p_scope text, p_ip_hash text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  k record;
  kid uuid;
  s record;
  v_endpoint text;
  v_bucket text;
  lim integer;
  win timestamptz := date_trunc('minute', now());
  v_hits integer;
  fails integer;
  log_id bigint;
  tok text;
  retry integer := greatest(1, ceil(extract(epoch from (date_trunc('minute', now()) + interval '1 minute' - now())))::int);
begin
  if p_scope is null or p_scope not in ('catalogue:read', 'calculator:execute') or p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$'
     or (p_key_hash is not null and p_key_hash !~ '^[0-9a-f]{64}$') then
    return jsonb_build_object('ok', false, 'status', 400, 'code', 'BAD_REQUEST');
  end if;
  v_endpoint := case p_scope when 'catalogue:read' then 'catalogue' else 'calculate' end;
  perform private.api_cleanup();

  -- An IP that sent 20 wrong keys in the last 10 minutes is refused until that window passes.
  select coalesce(sum(failures), 0) into fails from private.api_ip_failures
   where ip_hash = p_ip_hash and window_start > now() - interval '10 minutes';
  if fails >= 20 then
    return jsonb_build_object('ok', false, 'status', 429, 'code', 'TOO_MANY_INVALID_KEYS', 'retry_after', 600);
  end if;

  if p_key_hash is null then
    select * into s from private.api_settings where id;
    if p_scope <> 'catalogue:read' or not s.anonymous_catalogue then
      insert into private.api_requests (endpoint, status, error_code, finished) values (v_endpoint, 401, 'MISSING_API_KEY', true);
      return jsonb_build_object('ok', false, 'status', 401, 'code', 'MISSING_API_KEY');
    end if;
    v_bucket := 'ip:' || p_ip_hash;
    lim := s.anonymous_catalogue_rpm;
  else
    select * into k from private.api_keys where key_hash = p_key_hash;
    if not found then
      insert into private.api_ip_failures as f (ip_hash, window_start, failures)
      values (p_ip_hash, date_trunc('minute', now()), 1)
      on conflict (ip_hash, window_start) do update set failures = f.failures + 1;
      insert into private.api_requests (endpoint, status, error_code, finished) values (v_endpoint, 401, 'INVALID_API_KEY', true);
      return jsonb_build_object('ok', false, 'status', 401, 'code', 'INVALID_API_KEY');
    end if;
    if k.revoked_at is not null then
      insert into private.api_requests (key_id, endpoint, status, error_code, finished) values (k.id, v_endpoint, 401, 'API_KEY_REVOKED', true);
      return jsonb_build_object('ok', false, 'status', 401, 'code', 'API_KEY_REVOKED');
    end if;
    if k.expires_at is not null and k.expires_at <= now() then
      insert into private.api_requests (key_id, endpoint, status, error_code, finished) values (k.id, v_endpoint, 401, 'API_KEY_EXPIRED', true);
      return jsonb_build_object('ok', false, 'status', 401, 'code', 'API_KEY_EXPIRED');
    end if;
    if not (p_scope = any (k.scopes)) then
      insert into private.api_requests (key_id, endpoint, status, error_code, finished) values (k.id, v_endpoint, 403, 'INSUFFICIENT_SCOPE', true);
      return jsonb_build_object('ok', false, 'status', 403, 'code', 'INSUFFICIENT_SCOPE');
    end if;
    kid := k.id;
    v_bucket := 'key:' || kid::text;
    lim := case p_scope when 'catalogue:read' then k.catalogue_rpm else k.calculator_rpm end;
  end if;

  -- One atomic upsert per request: concurrent requests on any number of servers each get a distinct count.
  insert into private.api_rate as r (bucket, scope, window_start, hits) values (v_bucket, p_scope, win, 1)
  on conflict (bucket, scope, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;
  if v_hits > lim then
    insert into private.api_requests (key_id, endpoint, status, error_code, finished) values (kid, v_endpoint, 429, 'RATE_LIMITED', true);
    return jsonb_build_object('ok', false, 'status', 429, 'code', 'RATE_LIMITED', 'retry_after', retry, 'limit', lim, 'remaining', 0);
  end if;

  if kid is not null then
    if k.last_used_at is null or k.last_used_at < now() - interval '1 minute' then
      update private.api_keys set last_used_at = now() where id = kid;
    end if;
  end if;
  tok := encode(extensions.gen_random_bytes(16), 'hex');
  insert into private.api_requests (key_id, endpoint, token) values (kid, v_endpoint, tok) returning id into log_id;
  return jsonb_build_object('ok', true, 'key_id', kid, 'limit', lim, 'remaining', greatest(0, lim - v_hits), 'reset', retry,
    'log_id', log_id, 'log_token', tok);
end;
$$;

-- Closes the log row api_authorize opened: final status, error code and time taken. Only once, and only with its token.
create or replace function public.api_finish(p_log_id bigint, p_token text, p_status integer, p_latency_ms integer, p_error_code text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update private.api_requests
     set status = least(greatest(p_status, 100), 599), latency_ms = least(greatest(p_latency_ms, 0), 600000),
         error_code = case when p_error_code ~ '^[A-Z_]{1,40}$' then p_error_code end, finished = true, token = null
   where id = p_log_id and not finished and token is not null and token = p_token;
$$;

revoke all on function public.api_authorize(text, text, text) from public;
revoke all on function public.api_finish(bigint, text, integer, integer, text) from public;
grant execute on function public.api_authorize(text, text, text) to anon, authenticated;
grant execute on function public.api_finish(bigint, text, integer, integer, text) to anon, authenticated;

-- ---------------------------------------------------------------- admin (dashboard)

create or replace function private.require_api_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_api_admin() then
    raise exception 'Only the site administrator can do this.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.require_api_admin() from public, anon, authenticated;

-- Is the signed-in account the administrator? (The dashboard uses it to choose what to show; every admin function
-- checks again on its own.)
create or replace function public.api_admin_check()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_api_admin();
$$;

-- Key list without hashes or secrets.
create or replace function public.api_admin_list_keys()
returns table (id uuid, label text, prefix text, scopes text[], catalogue_rpm integer, calculator_rpm integer, created_at timestamptz,
  expires_at timestamptz, revoked_at timestamptz, last_used_at timestamptz, replaced_by uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_api_admin();
  return query select k.id, k.label, k.prefix, k.scopes, k.catalogue_rpm, k.calculator_rpm, k.created_at, k.expires_at, k.revoked_at,
    k.last_used_at, k.replaced_by from private.api_keys k order by k.created_at desc;
end;
$$;

-- Creates a key and returns its secret. This is the only time the secret exists outside the caller.
create or replace function public.api_admin_create_key(p_label text, p_scopes text[], p_expires_at timestamptz default null,
  p_catalogue_rpm integer default 60, p_calculator_rpm integer default 120)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  secret text := private.new_api_key();
  new_id uuid;
begin
  perform private.require_api_admin();
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'The expiry date must be in the future.' using errcode = '22023';
  end if;
  insert into private.api_keys (label, prefix, key_hash, scopes, catalogue_rpm, calculator_rpm, created_by, expires_at)
  values (btrim(p_label), left(secret, 12), encode(extensions.digest(secret, 'sha256'), 'hex'),
    (select array_agg(distinct s order by s) from unnest(p_scopes) s), p_catalogue_rpm, p_calculator_rpm, (select auth.uid()), p_expires_at)
  returning id into new_id;
  return jsonb_build_object('id', new_id, 'key', secret, 'prefix', left(secret, 12));
end;
$$;

-- Revokes a key straight away (the next request with it is refused).
create or replace function public.api_admin_revoke_key(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_api_admin();
  update private.api_keys set revoked_at = coalesce(revoked_at, now()) where id = p_id;
  if not found then
    raise exception 'No such key.' using errcode = 'P0002';
  end if;
end;
$$;

-- Rotation: a new key with the same label, scopes and limits; the old one keeps working for p_overlap_hours
-- (0 to 168) so the bot can switch over, then expires.
create or replace function public.api_admin_rotate_key(p_id uuid, p_overlap_hours integer default 24)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  old record;
  secret text := private.new_api_key();
  new_id uuid;
  ends timestamptz;
begin
  perform private.require_api_admin();
  if p_overlap_hours is null or p_overlap_hours not between 0 and 168 then
    raise exception 'Overlap must be 0 to 168 hours.' using errcode = '22023';
  end if;
  select * into old from private.api_keys where id = p_id for update;
  if not found or old.revoked_at is not null then
    raise exception 'No active key to rotate.' using errcode = 'P0002';
  end if;
  insert into private.api_keys (label, prefix, key_hash, scopes, catalogue_rpm, calculator_rpm, created_by, expires_at)
  values (old.label, left(secret, 12), encode(extensions.digest(secret, 'sha256'), 'hex'), old.scopes, old.catalogue_rpm, old.calculator_rpm,
    (select auth.uid()), old.expires_at)
  returning id into new_id;
  ends := now() + make_interval(hours => p_overlap_hours);
  update private.api_keys set replaced_by = new_id,
    expires_at = case when expires_at is null or expires_at > ends then ends else expires_at end,
    revoked_at = case when p_overlap_hours = 0 then now() else revoked_at end
  where id = p_id;
  return jsonb_build_object('id', new_id, 'key', secret, 'prefix', left(secret, 12), 'old_key_expires_at', ends);
end;
$$;

create or replace function public.api_admin_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s record;
begin
  perform private.require_api_admin();
  select * into s from private.api_settings where id;
  return jsonb_build_object('anonymous_catalogue', s.anonymous_catalogue, 'anonymous_catalogue_rpm', s.anonymous_catalogue_rpm);
end;
$$;

create or replace function public.api_admin_set_settings(p_anonymous_catalogue boolean, p_anonymous_catalogue_rpm integer default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_api_admin();
  update private.api_settings set anonymous_catalogue = p_anonymous_catalogue,
    anonymous_catalogue_rpm = coalesce(p_anonymous_catalogue_rpm, anonymous_catalogue_rpm)
  where id;
end;
$$;

-- Usage for the dashboard (the log keeps 30 days): totals, per day, per key and the latest requests.
create or replace function public.api_admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  out jsonb;
begin
  perform private.require_api_admin();
  select jsonb_build_object(
    'total_30d', (select count(*) from private.api_requests),
    'last_24h', (select count(*) from private.api_requests where at > now() - interval '24 hours'),
    'last_7d', (select count(*) from private.api_requests where at > now() - interval '7 days'),
    'failed_7d', (select count(*) from private.api_requests where at > now() - interval '7 days' and status >= 400),
    'rate_limited_7d', (select count(*) from private.api_requests where at > now() - interval '7 days' and status = 429),
    'active_keys', (select count(*) from private.api_keys where revoked_at is null and (expires_at is null or expires_at > now())),
    'latency_ms_7d', (select jsonb_build_object(
        'avg', round(avg(latency_ms)),
        'p95', percentile_disc(0.95) within group (order by latency_ms))
      from private.api_requests where at > now() - interval '7 days' and latency_ms is not null),
    'per_day', (select coalesce(jsonb_agg(d order by d->>'day'), '[]'::jsonb) from (
        select jsonb_build_object('day', to_char(date_trunc('day', at), 'YYYY-MM-DD'), 'requests', count(*),
          'failed', count(*) filter (where status >= 400), 'rate_limited', count(*) filter (where status = 429)) d
        from private.api_requests where at > now() - interval '30 days' group by date_trunc('day', at)) x),
    'per_key', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select k.id, k.label, k.prefix, count(r.*) filter (where r.at > now() - interval '7 days') as requests_7d,
          count(r.*) filter (where r.at > now() - interval '7 days' and r.status >= 400) as failed_7d
        from private.api_keys k left join private.api_requests r on r.key_id = k.id
        group by k.id order by requests_7d desc) x),
    'errors_7d', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select error_code as code, count(*) as count from private.api_requests
        where at > now() - interval '7 days' and error_code is not null group by error_code order by count(*) desc limit 20) x),
    'recent', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select r.at, r.endpoint, r.status, r.latency_ms, r.error_code, k.label as key_label, k.prefix as key_prefix
        from private.api_requests r left join private.api_keys k on k.id = r.key_id
        order by r.at desc limit 50) x)
  ) into out;
  return out;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.api_admin_check()', 'public.api_admin_list_keys()',
    'public.api_admin_create_key(text, text[], timestamptz, integer, integer)', 'public.api_admin_revoke_key(uuid)',
    'public.api_admin_rotate_key(uuid, integer)', 'public.api_admin_settings()', 'public.api_admin_set_settings(boolean, integer)',
    'public.api_admin_stats()'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
