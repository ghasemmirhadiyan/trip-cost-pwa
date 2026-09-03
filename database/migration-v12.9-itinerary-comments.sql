-- v12.9: show commenter identity and allow all trip members to propose itinerary items.
-- Existing itinerary rows are treated as already-approved legacy items.

alter table public.itinerary_items
  add column if not exists status public.record_status not null default 'pending',
  add column if not exists submitted_by uuid references auth.users(id),
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists approved_at timestamptz,
  add column if not exists rejection_reason text;

-- Legacy itinerary entries were previously admin-only, so preserve them as approved.
update public.itinerary_items
set status='approved'
where submitted_by is null;

update public.itinerary_items
set submitted_by=created_by
where submitted_by is null;

alter table public.itinerary_items enable row level security;

drop policy if exists itinerary_insert_admin on public.itinerary_items;
drop policy if exists itinerary_insert_member on public.itinerary_items;
drop policy if exists itinerary_update_admin on public.itinerary_items;
drop policy if exists itinerary_delete_admin on public.itinerary_items;

drop policy if exists itinerary_select_member on public.itinerary_items;
create policy itinerary_select_member on public.itinerary_items
for select to authenticated
using (public.is_trip_member(trip_id));

create policy itinerary_insert_member on public.itinerary_items
for insert to authenticated
with check (
  public.is_trip_member(trip_id)
  and auth.uid()=created_by
  and auth.uid()=submitted_by
  and status='pending'
);

create policy itinerary_update_admin on public.itinerary_items
for update to authenticated
using (public.is_trip_admin(trip_id))
with check (public.is_trip_admin(trip_id));

create policy itinerary_delete_admin on public.itinerary_items
for delete to authenticated
using (public.is_trip_admin(trip_id));

create index if not exists idx_itinerary_status on public.itinerary_items(trip_id,status);

notify pgrst, 'reload schema';
