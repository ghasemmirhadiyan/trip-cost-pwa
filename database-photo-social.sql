-- Run this once in Supabase SQL Editor after the main schema.
create table if not exists public.photo_likes (id uuid primary key default gen_random_uuid(), photo_id uuid not null references public.album_photos(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), unique(photo_id,user_id));
create table if not exists public.photo_comments (id uuid primary key default gen_random_uuid(), photo_id uuid not null references public.album_photos(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, comment text not null check (char_length(trim(comment)) between 1 and 1000), created_at timestamptz not null default now());
alter table public.album_photos enable row level security; alter table public.photo_likes enable row level security; alter table public.photo_comments enable row level security;
create policy "trip members can read photos" on public.album_photos for select using (is_trip_member(trip_id));
create policy "trip members can add photos" on public.album_photos for insert with check (user_id=auth.uid() and is_trip_member(trip_id));
create policy "trip members can read likes" on public.photo_likes for select using (exists(select 1 from public.album_photos p where p.id=photo_id and is_trip_member(p.trip_id)));
create policy "members can like" on public.photo_likes for insert with check (user_id=auth.uid() and exists(select 1 from public.album_photos p where p.id=photo_id and is_trip_member(p.trip_id)));
create policy "members can unlike own" on public.photo_likes for delete using (user_id=auth.uid());
create policy "trip members can read comments" on public.photo_comments for select using (exists(select 1 from public.album_photos p where p.id=photo_id and is_trip_member(p.trip_id)));
create policy "members can comment" on public.photo_comments for insert with check (user_id=auth.uid() and exists(select 1 from public.album_photos p where p.id=photo_id and is_trip_member(p.trip_id)));
create policy "members can delete own comments" on public.photo_comments for delete using (user_id=auth.uid());
