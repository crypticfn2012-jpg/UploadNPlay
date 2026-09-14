-- UploadNPlay storage setup
-- Run after schema.sql (or use this by itself if the tables already exist).

insert into storage.buckets (id, name, public)
values
  ('game-files', 'game-files', true),
  ('thumbnails', 'thumbnails', true),
  ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

-- Public files are safe to read because game publication is controlled by
-- the database and only approved games are linked from the store.
drop policy if exists "public game files read" on storage.objects;
drop policy if exists "Public can read game files" on storage.objects;
create policy "Public can read game files"
on storage.objects for select
to public
using (bucket_id = 'game-files');

drop policy if exists "authenticated game files upload" on storage.objects;
drop policy if exists "Authenticated users can upload game files" on storage.objects;
create policy "Authenticated users can upload game files"
on storage.objects for insert
to authenticated
with check (bucket_id = 'game-files');

drop policy if exists "authenticated game files update" on storage.objects;
drop policy if exists "Authenticated users can update game files" on storage.objects;
create policy "Authenticated users can update game files"
on storage.objects for update
to authenticated
using (bucket_id = 'game-files')
with check (bucket_id = 'game-files');

drop policy if exists "Public can delete game files" on storage.objects;
create policy "Users can delete game files"
on storage.objects for delete
to authenticated
using (bucket_id = 'game-files');

drop policy if exists "public thumbnails read" on storage.objects;
drop policy if exists "Public can read thumbnails" on storage.objects;
create policy "Public can read thumbnails"
on storage.objects for select
to public
using (bucket_id = 'thumbnails');

drop policy if exists "authenticated thumbnails upload" on storage.objects;
drop policy if exists "Authenticated users can upload thumbnails" on storage.objects;
create policy "Authenticated users can upload thumbnails"
on storage.objects for insert
to authenticated
with check (bucket_id = 'thumbnails');

create policy "Authenticated users can update thumbnails"
on storage.objects for update
to authenticated
using (bucket_id = 'thumbnails')
with check (bucket_id = 'thumbnails');

create policy "Authenticated users can delete thumbnails"
on storage.objects for delete
to authenticated
using (bucket_id = 'thumbnails');

drop policy if exists "Public can read avatars" on storage.objects;
create policy "Public can read avatars"
on storage.objects for select
to public
using (bucket_id = 'avatars');

create policy "Users can upload avatars"
on storage.objects for insert
to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update avatars"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete avatars"
on storage.objects for delete
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
