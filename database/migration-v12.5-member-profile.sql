-- v12.5: مدیریت پروفایل اعضا توسط مدیر سفر
create or replace function public.update_trip_member_profile(
  p_member_id bigint,
  p_name text,
  p_phone text default null,
  p_share_weight numeric default 1,
  p_role trip_member_role default 'member'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip uuid;
  v_user uuid;
begin
  select trip_id, user_id into v_trip, v_user
  from public.trip_members where id=p_member_id and active=true;
  if v_trip is null then raise exception 'عضو پیدا نشد'; end if;
  if auth.uid() is null or not public.is_trip_admin(v_trip) then raise exception 'Admin access required'; end if;
  if trim(coalesce(p_name,''))='' then raise exception 'نام عضو الزامی است'; end if;
  if coalesce(p_share_weight,0)<=0 then raise exception 'تعداد سهم باید بیشتر از صفر باشد'; end if;
  if p_role='member' and v_user=auth.uid() then raise exception 'مدیر فعلی نمی‌تواند نقش خودش را به عضو تغییر دهد'; end if;

  update public.trip_members tm
  set name=trim(p_name),
      share_weight=p_share_weight,
      role=p_role,
      contribution_target=round(p_share_weight * (select share_amount from public.trips where id=v_trip))::bigint,
      updated_at=now()
  where tm.id=p_member_id;

  if v_user is not null then
    update public.profiles
    set display_name=trim(p_name), phone=nullif(trim(coalesce(p_phone,'')),''), updated_at=now()
    where user_id=v_user;
  end if;
end;
$$;

grant execute on function public.update_trip_member_profile(bigint,text,text,numeric,trip_member_role) to authenticated;
notify pgrst, 'reload schema';
