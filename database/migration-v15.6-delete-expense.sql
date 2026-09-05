-- v15.6: admin deletion of expenses

create or replace function public.delete_expense_admin(
  p_expense_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
begin
  select trip_id into v_trip_id
  from public.expenses
  where id = p_expense_id;

  if v_trip_id is null then
    raise exception 'هزینه پیدا نشد';
  end if;

  if not exists (
    select 1 from public.trip_members tm
    where tm.trip_id = v_trip_id
      and tm.user_id = auth.uid()
      and tm.role = 'admin'
      and tm.active = true
  ) then
    raise exception 'فقط مدیر سفر می‌تواند هزینه را حذف کند';
  end if;

  delete from public.expense_participants where expense_id = p_expense_id;
  delete from public.expenses where id = p_expense_id;
end;
$$;

revoke all on function public.delete_expense_admin(uuid) from public;
grant execute on function public.delete_expense_admin(uuid) to authenticated;

notify pgrst, 'reload schema';
