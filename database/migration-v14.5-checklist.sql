-- v14.5: shared trip checklist for all active members
create table if not exists public.trip_checklist_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  item text not null check (char_length(trim(item)) between 1 and 200),
  added_by uuid not null references auth.users(id) on delete cascade,
  is_done boolean not null default false,
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trip_checklist_items_trip_idx on public.trip_checklist_items(trip_id, created_at desc);

alter table public.trip_checklist_items enable row level security;
drop policy if exists "checklist_select_members" on public.trip_checklist_items;
drop policy if exists "checklist_insert_members" on public.trip_checklist_items;
drop policy if exists "checklist_update_members" on public.trip_checklist_items;
drop policy if exists "checklist_delete_members" on public.trip_checklist_items;

create policy "checklist_select_members" on public.trip_checklist_items
for select to authenticated using (
  exists (select 1 from public.trip_members tm where tm.trip_id=trip_checklist_items.trip_id and tm.user_id=auth.uid() and tm.active=true)
);
create policy "checklist_insert_members" on public.trip_checklist_items
for insert to authenticated with check (
  added_by=auth.uid() and exists (select 1 from public.trip_members tm where tm.trip_id=trip_checklist_items.trip_id and tm.user_id=auth.uid() and tm.active=true)
);
create policy "checklist_update_members" on public.trip_checklist_items
for update to authenticated using (
  exists (select 1 from public.trip_members tm where tm.trip_id=trip_checklist_items.trip_id and tm.user_id=auth.uid() and tm.active=true)
) with check (
  exists (select 1 from public.trip_members tm where tm.trip_id=trip_checklist_items.trip_id and tm.user_id=auth.uid() and tm.active=true)
);
create policy "checklist_delete_members" on public.trip_checklist_items
for delete to authenticated using (
  added_by=auth.uid() or exists (select 1 from public.trip_members tm where tm.trip_id=trip_checklist_items.trip_id and tm.user_id=auth.uid() and tm.role='admin' and tm.active=true)
);
notify pgrst, 'reload schema';
