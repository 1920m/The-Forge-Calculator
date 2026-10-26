-- Feedback from the site's "Send feedback" window. Anyone can send (signed in or not); nobody can read it back
-- through the API. Reports and their attached images are read in the Supabase dashboard.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('bug', 'feature', 'other', 'praise')),
  message text not null check (char_length(btrim(message)) between 3 and 2000),
  page text check (char_length(page) <= 500 and page ~ '^/'),
  browser text check (char_length(browser) <= 300),
  app_version text not null check (char_length(app_version) between 1 and 60),
  files text[] not null default '{}' check (cardinality(files) <= 3),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  ip_hash text
);

alter table public.feedback enable row level security;

revoke all on public.feedback from anon, authenticated, public;
grant insert (id, kind, message, page, browser, app_version, files) on public.feedback to anon, authenticated;

create policy feedback_insert on public.feedback
  for insert to anon, authenticated
  with check (user_id is not distinct from (select auth.uid()));

-- Anti-spam: at most 5 reports an hour from one connection and 300 a day in total. The connection is stored only
-- as a salted hash, used for this limit. Attached files must sit in this report's own folder.
create or replace function private.check_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ip text := coalesce(split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1), 'unknown');
  f text;
begin
  new.ip_hash := encode(extensions.digest('forge-feedback:' || btrim(ip), 'sha256'), 'hex');
  new.created_at := now();
  if (select count(*) from public.feedback where ip_hash = new.ip_hash and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many reports from here. Please try again in an hour.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.feedback where created_at > now() - interval '1 day') >= 300 then
    raise exception 'Feedback is busy right now. Please try again tomorrow.' using errcode = 'P0001';
  end if;
  foreach f in array new.files loop
    if f !~ ('^' || new.id::text || '/[1-3]\.(png|jpg|webp)$') then
      raise exception 'Bad file name.' using errcode = 'P0001';
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function private.check_feedback() from public, anon, authenticated;

create trigger feedback_check
  before insert on public.feedback
  for each row execute function private.check_feedback();

-- Private bucket for screenshots: images only, 5 MB each, upload-only (no reading, listing or overwriting through
-- the API), at most 60 uploads an hour across the whole site.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-files', 'feedback-files', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.feedback_upload_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from storage.objects where bucket_id = 'feedback-files' and created_at > now() - interval '1 hour') < 60;
$$;

revoke all on function private.feedback_upload_allowed() from public;
grant execute on function private.feedback_upload_allowed() to anon, authenticated;

create policy feedback_files_upload on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'feedback-files'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[1-3]\.(png|jpg|webp)$'
    and private.feedback_upload_allowed()
  );
