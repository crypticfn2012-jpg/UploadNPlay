create policy "public game files read" on storage.objects for select using (bucket_id = 'game-files');
create policy "authenticated game files upload" on storage.objects for insert to authenticated with check (bucket_id = 'game-files');
create policy "authenticated game files update" on storage.objects for update to authenticated using (bucket_id = 'game-files');
create policy "public thumbnails read" on storage.objects for select using (bucket_id = 'thumbnails');
create policy "authenticated thumbnails upload" on storage.objects for insert to authenticated with check (bucket_id = 'thumbnails');
