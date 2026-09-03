-- v12.2: همه اعضا می‌توانند مکان پیشنهاد کنند؛ فقط مدیر تأیید می‌کند.
-- مکان‌های قبلی پاک می‌شوند چون لیست مکان‌ها از نو ساخته خواهد شد.

alter table public.locations
  add column if not exists status public.record_status not null default 'pending',
  add column if not exists submitted_by uuid,
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists rejection_reason text;

-- برای نصب تمیز v12.2، مکان‌های قبلی حذف می‌شوند.
delete from public.locations;

-- پیشنهاد مکان فقط توسط عضو فعال همان سفر.
drop policy if exists locations_insert_admin on public.locations;
drop policy if exists locations_insert_member on public.locations;
create policy locations_insert_member on public.locations
for insert to authenticated
with check (
  public.is_trip_member(trip_id)
  and auth.uid() = created_by
  and auth.uid() = submitted_by
  and status = 'pending'
);

-- مشاهده برای همه اعضا؛ موارد pending/rejected هم دیده می‌شوند تا وضعیت شفاف باشد.
drop policy if exists locations_select_member on public.locations;
create policy locations_select_member on public.locations
for select to authenticated
using (public.is_trip_member(trip_id));

-- فقط مدیر می‌تواند تأیید/رد/حذف کند.
drop policy if exists locations_update_admin on public.locations;
create policy locations_update_admin on public.locations
for update to authenticated
using (public.is_trip_admin(trip_id))
with check (public.is_trip_admin(trip_id));

drop policy if exists locations_delete_admin on public.locations;
create policy locations_delete_admin on public.locations
for delete to authenticated
using (public.is_trip_admin(trip_id));

notify pgrst, 'reload schema';
