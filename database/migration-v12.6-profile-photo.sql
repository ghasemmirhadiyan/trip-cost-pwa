-- v12.6: عکس پروفایل شخصی + سیاست‌های Storage
alter table public.profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public) values ('profile-photos','profile-photos',true)
on conflict (id) do update set public=true;

drop policy if exists profile_photos_insert_own on storage.objects;
create policy profile_photos_insert_own on storage.objects
for insert to authenticated
with check (bucket_id='profile-photos' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists profile_photos_update_own on storage.objects;
create policy profile_photos_update_own on storage.objects
for update to authenticated
using (bucket_id='profile-photos' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='profile-photos' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists profile_photos_delete_own on storage.objects;
create policy profile_photos_delete_own on storage.objects
for delete to authenticated
using (bucket_id='profile-photos' and (storage.foldername(name))[1]=auth.uid()::text);

notify pgrst, 'reload schema';
