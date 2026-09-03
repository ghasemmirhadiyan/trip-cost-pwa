-- v11.8: پاک‌سازی داده‌های سفر و نگه‌داشتن فقط یک سفر + ادمین اصلی
-- این اسکریپت حساب‌های auth و profiles را حذف نمی‌کند.
-- یک سفر که در آن حداقل یک ادمین فعال وجود دارد نگه داشته می‌شود.
-- همه هزینه‌ها، واریزی‌ها، اعضای دیگر، رأی‌گیری، برنامه، آلبوم و سایر داده‌های سفر پاک می‌شوند.

do $$
declare
  keep_trip uuid;
  keep_admin uuid;
begin
  select tm.trip_id, tm.user_id
    into keep_trip, keep_admin
  from public.trip_members tm
  join public.trips t on t.id = tm.trip_id
  where tm.active = true and tm.role = 'admin'
  order by t.created_at asc
  limit 1;

  if keep_trip is null or keep_admin is null then
    raise exception 'هیچ سفر دارای ادمین فعالی پیدا نشد. ابتدا یک ادمین/سفر معتبر ایجاد کنید.';
  end if;

  -- جداول اختیاریِ دعوت و درخواست عضویت را اگر وجود داشته باشند پاک می‌کنیم.
  if to_regclass('public.membership_requests') is not null then
    execute 'delete from public.membership_requests';
  end if;
  if to_regclass('public.trip_invites') is not null then
    execute 'delete from public.trip_invites';
  end if;

  -- داده‌های وابسته به هزینه‌ها
  delete from public.expense_participants;
  delete from public.expenses;
  delete from public.fund_contributions;

  -- رأی‌گیری و برنامه سفر
  delete from public.poll_votes;
  delete from public.poll_options;
  delete from public.polls;
  delete from public.itinerary_items;
  delete from public.locations;

  -- آلبوم، چک‌لیست، اعلان و تاریخچه
  delete from public.album_photos;
  delete from public.checklist_items;
  delete from public.notifications;
  delete from public.audit_logs;

  -- همه اعضای همه سفرها به جز ادمین اصلی حذف شوند.
  delete from public.trip_members
  where not (trip_id = keep_trip and user_id = keep_admin);

  -- همه سفرهای دیگر حذف شوند.
  delete from public.trips where id <> keep_trip;

  -- سفر باقی‌مانده به یک سفر تمیز تبدیل شود.
  update public.trips
  set title = 'سفر شمال ۱۴۰۵',
      destination = 'شمال ایران',
      start_date = null,
      end_date = null,
      opening_fund = 0,
      is_active = true,
      updated_at = now()
  where id = keep_trip;

  -- مشخصات ادمین اصلی برای شروع محاسبات از صفر
  update public.trip_members
  set name = coalesce(nullif(trim(name), ''), 'مدیر سفر'),
      role = 'admin',
      share_weight = 1,
      contribution_target = 0,
      active = true
  where trip_id = keep_trip and user_id = keep_admin;

  raise notice 'Single trip reset completed. Trip ID: %, Admin User ID: %', keep_trip, keep_admin;
end $$;

notify pgrst, 'reload schema';
