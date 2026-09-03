-- v13.3: invite-based self registration + admin approval + fixed default coefficient
-- Run once in Supabase SQL Editor.

create or replace function public.approve_membership_request(
  p_request_id bigint,
  p_name text,
  p_share_weight numeric default 1,
  p_contribution_target bigint default null,
  p_role public.trip_member_role default 'member'
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.membership_requests%rowtype;
  v_member_id bigint;
  v_share_amount bigint;
  v_weight numeric;
begin
  select * into r
  from public.membership_requests
  where id=p_request_id
  for update;

  if not found then raise exception 'Membership request not found'; end if;
  if not public.is_trip_admin(r.trip_id) then raise exception 'Admin access required'; end if;
  if r.status <> 'pending' then raise exception 'Request is not pending'; end if;
  if exists(select 1 from public.trip_members where trip_id=r.trip_id and user_id=r.user_id and active=true) then
    raise exception 'این کاربر قبلاً عضو فعال این سفر است';
  end if;

  v_weight := coalesce(p_share_weight,1);
  if v_weight <= 0 then raise exception 'ضریب مشارکت باید بیشتر از صفر باشد'; end if;

  select coalesce(share_amount,12000000)
    into v_share_amount
  from public.trips
  where id=r.trip_id;

  insert into public.trip_members(
    trip_id,user_id,name,role,share_weight,contribution_target
  ) values(
    r.trip_id,
    r.user_id,
    coalesce(nullif(trim(p_name),''),r.full_name),
    coalesce(p_role,'member'::public.trip_member_role),
    v_weight,
    round(v_weight * v_share_amount)::bigint
  ) returning id into v_member_id;

  update public.membership_requests
  set status='approved',reviewed_by=auth.uid(),reviewed_at=now()
  where id=p_request_id;

  return v_member_id;
end;
$$;

grant execute on function public.approve_membership_request(bigint,text,numeric,bigint,public.trip_member_role) to authenticated;
notify pgrst, 'reload schema';
