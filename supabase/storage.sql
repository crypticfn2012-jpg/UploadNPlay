insert into storage.buckets (id,name,public) values ('game-files','game-files',true) on conflict (id) do update set public=true;
insert into storage.buckets (id,name,public) values ('thumbnails','thumbnails',true) on conflict (id) do update set public=true;
