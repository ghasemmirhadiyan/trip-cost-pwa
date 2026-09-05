-- v15.5: admin deletion of fund contributions

create or replace function public.delete_fund_contribution_admin(
  p_contribution_id uuid
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
  from public.fund_contributions
  where id=p_contribution_id;

  if v_trip_id is null then
    raise exception 'تراکنش صندوق پیدا نشد';
  end if;

  if not exists (
    select 1 from public.trip_members tm
    where tm.trip_id=v_trip_id
      and tm.user_id=auth.uid()
      and tm.role='admin'
      and tm.active=true
  ) then
    raise exception 'فقط مدیر سفر می‌تواند تراکنش صندوق را حذف کند';
  end if;

  delete from public.fund_contributions where id=p_contribution_id;
end;
$$;

revoke all on function public.delete_fund_contribution_admin(uuid) from public;
grant execute on function public.delete_fund_contribution_admin(uuid) to authenticated;

notify pgrst, 'reload schema';
