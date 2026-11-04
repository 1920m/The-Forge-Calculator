-- Tighter limits on feedback screenshots (security pass, 3 Nov 2026). Anyone can attach screenshots without signing
-- in, so the old limits (5 MB each, 60 an hour) would let someone fill the project's storage in a few hours.
-- The site now shrinks screenshots in the browser before uploading, so 2 MB is plenty.

update storage.buckets set file_size_limit = 2097152 where id = 'feedback-files';

-- At most 20 screenshots an hour and 60 a day across everyone: about 120 MB a day at worst.
create or replace function private.feedback_upload_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from storage.objects where bucket_id = 'feedback-files' and created_at > now() - interval '1 hour') < 20
     and (select count(*) from storage.objects where bucket_id = 'feedback-files' and created_at > now() - interval '1 day') < 60;
$$;
