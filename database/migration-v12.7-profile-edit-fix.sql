-- v12.7: اصلاح ویرایش پروفایل اعضا
-- این migration را یک بار در Supabase اجرا کنید.

create or replace function public.update_trip_member_profile(
  p_member_id bigint,
  p_name text,
  p_phone text default null,
  p_share_weight numeric default 1,
  p_role public.trip_member_role default 'member'::public.trip_member_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip uuid;
  v_user uuid;
  v_share_amount bigint;
  v_caller uuid := auth.uid();
begin
  if v_caller is null then raise exception 'ابتدا وارد حساب شوید'; end if;

  select tm.trip_id, tm.user_id
    into v_trip, v_user
  from public.trip_members tm
  where tm.id = p_member_id and tm.active = true;

  if v_trip is null then raise exception 'عضو پیدا نشد یا عضویت او غیرفعال است'; end if;
  if not public.is_trip_admin(v_trip) then raise exception 'فقط مدیر سفر می‌تواند پروفایل اعضا را ویرایش کند'; end if;
  if trim(coalesce(p_name,'')) = '' then raise exception 'نام عضو الزامی است'; end if;
  if coalesce(p_share_weight,0) <= 0 then raise exception 'تعداد سهم باید بیشتر از صفر باشد'; end if;
  if p_role = 'member'::public.trip_member_role and v_user = v_caller then
    raise exception 'مدیر فعلی نمی‌تواند نقش خودش را به عضو تغییر دهد';
  end if;

  select coalesce(share_amount,0) into v_share_amount
  from public.trips where id=v_trip;

  update public.trip_members
  set name = trim(p_name),
      share_weight = p_share_weight,
      role = p_role,
      contribution_target = round(p_share_weight * v_share_amount)::bigint,
      updated_at = now()
  where id = p_member_id;

  if v_user is not null then
    update public.profiles
    set display_name = trim(p_name),
        phone = nullif(trim(coalesce(p_phone,'')),''),
        updated_at = now()
    where user_id = v_user;
  end if;
end;
$$;

grant execute on function public.update_trip_member_profile(bigint,text,text,numeric,public.trip_member_role) to authenticated;

notify pgrst, 'reload schema';
