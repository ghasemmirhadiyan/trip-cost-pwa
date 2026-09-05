-- v15.4: admin-editable fund transactions + member startup announcements

create table if not exists public.trip_announcements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  message text not null check (char_length(trim(message)) between 1 and 1000),
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trip_announcements_trip_idx on public.trip_announcements(trip_id, is_active, created_at desc);

alter table public.trip_announcements enable row level security;
drop policy if exists "announcements_select_members" on public.trip_announcements;
drop policy if exists "announcements_insert_admin" on public.trip_announcements;
drop policy if exists "announcements_update_admin" on public.trip_announcements;
drop policy if exists "announcements_delete_admin" on public.trip_announcements;
create policy "announcements_select_members" on public.trip_announcements
for select to authenticated using (
  exists (select 1 from public.trip_members tm where tm.trip_id=trip_announcements.trip_id and tm.user_id=auth.uid() and tm.active=true)
);
create policy "announcements_insert_admin" on public.trip_announcements
for insert to authenticated with check (
  created_by=auth.uid() and exists (select 1 from public.trip_members tm where tm.trip_id=trip_announcements.trip_id and tm.user_id=auth.uid() and tm.role='admin' and tm.active=true)
);
create policy "announcements_update_admin" on public.trip_announcements
for update to authenticated using (
  exists (select 1 from public.trip_members tm where tm.trip_id=trip_announcements.trip_id and tm.user_id=auth.uid() and tm.role='admin' and tm.active=true)
) with check (
  exists (select 1 from public.trip_members tm where tm.trip_id=trip_announcements.trip_id and tm.user_id=auth.uid() and tm.role='admin' and tm.active=true)
);
create policy "announcements_delete_admin" on public.trip_announcements
for delete to authenticated using (
  exists (select 1 from public.trip_members tm where tm.trip_id=trip_announcements.trip_id and tm.user_id=auth.uid() and tm.role='admin' and tm.active=true)
);

grant select on public.trip_announcements to authenticated;
grant insert, update, delete on public.trip_announcements to authenticated;

create or replace function public.update_fund_contribution_admin(
  p_contribution_id uuid,
  p_trip_member_id bigint,
  p_amount bigint,
  p_method public.contribution_method,
  p_contribution_date date,
  p_note text
)
returns public.fund_contributions
language plpgsql
security definer
set search_path = public
as $$
declare r public.fund_contributions;
begin
  if not exists (
    select 1 from public.trip_members tm
    where tm.trip_id=(select trip_id from public.fund_contributions where id=p_contribution_id)
      and tm.user_id=auth.uid() and tm.role='admin' and tm.active=true
  ) then raise exception 'فقط مدیر سفر می‌تواند تراکنش صندوق را ویرایش کند'; end if;
  if p_amount <= 0 then raise exception 'مبلغ باید بیشتر از صفر باشد'; end if;
  if not exists (
    select 1 from public.trip_members tm
    where tm.id=p_trip_member_id and tm.active=true
      and tm.trip_id=(select trip_id from public.fund_contributions where id=p_contribution_id)
  ) then raise exception 'عضو انتخاب‌شده معتبر نیست'; end if;
  update public.fund_contributions
    set trip_member_id=p_trip_member_id,
        amount=p_amount,
        method=p_method,
        contribution_date=p_contribution_date,
        note=nullif(trim(coalesce(p_note,'')),''),
        updated_at=now()
    where id=p_contribution_id
    returning * into r;
  if not found then raise exception 'تراکنش صندوق پیدا نشد'; end if;
  return r;
end;
$$;
revoke all on function public.update_fund_contribution_admin(uuid,bigint,bigint,public.contribution_method,date,text) from public;
grant execute on function public.update_fund_contribution_admin(uuid,bigint,bigint,public.contribution_method,date,text) to authenticated;

notify pgrst, 'reload schema';
