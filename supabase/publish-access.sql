-- UploadNPlay publishing access
-- Run this once in the Supabase SQL Editor.
-- Publishing is open to signed-in users; moderation still controls what becomes public.

alter table public.profiles
  alter column is_dev set default true;

update public.profiles
set is_dev = true
where is_dev = false;

comment on column public.profiles.is_dev is
  'Whether the account has access to the developer publishing area. Publishing is open to authenticated users; this flag controls the developer UI.';
