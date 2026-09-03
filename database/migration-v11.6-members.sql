-- v11.6: Admin can add an existing registered user directly by phone.
create or replace function public.add_trip_member_by_phone(
  p_trip_id uuid, p_phone text, p_name text default null,
  p_share_weight numeric default 1, p_contribution_target bigint default 0
)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare v_user uuid; v_member_id bigint; v_name text;
begin
  if not public.is_trip_admin(p_trip_id) then raise exception 'Admin access required'; end if;
  select user_id, display_name into v_user, v_name from public.profiles where phone=trim(p_phone) limit 1;
  if v_user is null then raise exception 'کاربری با این شماره موبایل پیدا نشد'; end if;
  if exists (select 1 from public.trip_members where trip_id=p_trip_id and user_id=v_user) then raise exception 'این کاربر قبلاً عضو این سفر است'; end if;
  v_name := coalesce(nullif(trim(p_name),''),v_name,'عضو سفر');
  insert into public.trip_members(trip_id,user_id,name,role,share_weight,contribution_target)
  values(p_trip_id,v_user,v_name,'member',greatest(p_share_weight,0.001),greatest(p_contribution_target,0))
  returning id into v_member_id;
  return v_member_id;
end;
$$;
grant execute on function public.add_trip_member_by_phone(uuid,text,text,numeric,bigint) to authenticated;
notify pgrst, 'reload schema';
