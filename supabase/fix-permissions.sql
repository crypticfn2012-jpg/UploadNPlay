-- UploadNPlay permissions repair
-- Run this in the Supabase SQL Editor if the site says:
-- "permission denied for table games"

-- Make the public API roles able to reach the tables.
grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant select on public.games to anon, authenticated;
grant insert, update, delete on public.games to authenticated;
grant select, insert on public.game_views to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- Recreate the public game read policy.
alter table public.games enable row level security;
drop policy if exists "Approved games are public" on public.games;
create policy "Approved games are public"
on public.games for select
to anon, authenticated
using (
  status = 'approved'
  or auth.uid() = developer_id
  or public.is_admin()
);

-- Recreate the view policies used by the frontend.
alter table public.game_views enable row level security;
drop policy if exists "Anyone can record game views" on public.game_views;
drop policy if exists "Developers can read their game views" on public.game_views;
create policy "Anyone can record game views"
on public.game_views for insert
to anon, authenticated
with check (true);
create policy "Developers can read their game views"
on public.game_views for select
to authenticated
using (
  exists (
    select 1 from public.games g
    where g.id = game_id and g.developer_id = auth.uid()
  )
  or public.is_admin()
);

-- Keep profile reads public for developer names.
alter table public.profiles enable row level security;
drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable"
on public.profiles for select
to anon, authenticated
using (true);
