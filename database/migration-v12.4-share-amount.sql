-- v12.4: مبلغ پایه هر سهم برای صندوق
-- مبلغ تعهد هر عضو = تعداد سهم (share_weight) × مبلغ هر سهم

alter table public.trips
add column if not exists share_amount bigint not null default 12000000
check (share_amount > 0);

-- مقدار فعلی سفرهای موجود: ۱۲ میلیون تومان برای هر سهم، مگر اینکه قبلاً مقدار مناسبی داشته باشند.
update public.trips
set share_amount = 12000000
where share_amount is null or share_amount <= 0;

-- همگام‌سازی تعهد اعضای فعلی با مبلغ هر سهم
update public.trip_members tm
set contribution_target = round(tm.share_weight * t.share_amount)::bigint,
    updated_at = now()
from public.trips t
where t.id = tm.trip_id;

create or replace function public.set_trip_share_amount(
  p_trip_id uuid,
  p_share_amount bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_trip_admin(p_trip_id) then
    raise exception 'Admin access required';
  end if;
  if p_share_amount is null or p_share_amount <= 0 then
    raise exception 'مبلغ هر سهم باید بیشتر از صفر باشد';
  end if;

  update public.trips
  set share_amount = p_share_amount,
      updated_at = now()
  where id = p_trip_id;

  update public.trip_members
  set contribution_target = round(share_weight * p_share_amount)::bigint,
      updated_at = now()
  where trip_id = p_trip_id;
end;
$$;

grant execute on function public.set_trip_share_amount(uuid,bigint) to authenticated;

notify pgrst, 'reload schema';


-- به‌روزرسانی تابع ساخت سفر: پارامتر p_contribution_target از این پس مبلغ هر سهم است.
create or replace function public.create_trip_with_admin(
  p_title text,
  p_destination text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_opening_fund bigint default 0,
  p_name text default null,
  p_phone text default null,
  p_share_weight numeric default 1,
  p_contribution_target bigint default 12000000
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_trip uuid; v_name text; v_share bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  v_name := coalesce(nullif(trim(p_name),''), 'مدیر سفر');
  v_share := greatest(coalesce(p_contribution_target,12000000),1);
  insert into public.trips(title,destination,start_date,end_date,opening_fund,share_amount,created_by)
  values(p_title,p_destination,p_start_date,p_end_date,p_opening_fund,v_share,auth.uid()) returning id into v_trip;
  insert into public.trip_members(trip_id,user_id,name,role,share_weight,contribution_target)
  values(v_trip,auth.uid(),v_name,'admin',greatest(p_share_weight,0.001),round(greatest(p_share_weight,0.001)*v_share)::bigint);
  return v_trip;
end; $$;
grant execute on function public.create_trip_with_admin(text,text,date,date,bigint,text,text,numeric,bigint) to authenticated;

notify pgrst, 'reload schema';
