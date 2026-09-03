-- v14.7: checklist responsibility / "من می‌آورم"
alter table public.trip_checklist_items
  add column if not exists responsible_user_id uuid references auth.users(id) on delete set null;

alter table public.trip_checklist_items
  add column if not exists responsible_at timestamptz;

create index if not exists trip_checklist_items_responsible_idx
  on public.trip_checklist_items(trip_id, responsible_user_id);

create or replace function public.claim_checklist_item(p_item_id uuid)
returns public.trip_checklist_items
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.trip_checklist_items;
begin
  if not exists (
    select 1 from public.trip_checklist_items i
    join public.trip_members tm on tm.trip_id=i.trip_id
    where i.id=p_item_id and tm.user_id=auth.uid() and tm.active=true
  ) then raise exception 'Not a member of this trip'; end if;

  update public.trip_checklist_items
     set responsible_user_id=auth.uid(), responsible_at=now(), updated_at=now()
   where id=p_item_id and responsible_user_id is null
   returning * into v_row;

  if v_row.id is null then raise exception 'This item is already claimed'; end if;
  return v_row;
end;
$$;

create or replace function public.release_checklist_item(p_item_id uuid)
returns public.trip_checklist_items
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.trip_checklist_items;
begin
  update public.trip_checklist_items i
     set responsible_user_id=null, responsible_at=null, updated_at=now()
   where i.id=p_item_id
     and i.responsible_user_id=auth.uid()
     and exists (
       select 1 from public.trip_members tm
       where tm.trip_id=i.trip_id and tm.user_id=auth.uid() and tm.active=true
     )
   returning * into v_row;

  if v_row.id is null then raise exception 'You are not responsible for this item'; end if;
  return v_row;
end;
$$;

revoke all on function public.claim_checklist_item(uuid) from public;
revoke all on function public.release_checklist_item(uuid) from public;
grant execute on function public.claim_checklist_item(uuid) to authenticated;
grant execute on function public.release_checklist_item(uuid) to authenticated;

notify pgrst, 'reload schema';
