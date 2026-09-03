-- پاک‌سازی کامل اطلاعات مالی سفر فعلی
-- حساب مدیر و خود سفر حفظ می‌شود.

DO $$
DECLARE
  v_trip uuid;
BEGIN
  SELECT id INTO v_trip
  FROM public.trips
  WHERE is_active = true
  ORDER BY created_at
  LIMIT 1;

  IF v_trip IS NULL THEN
    RAISE EXCEPTION 'هیچ سفر فعالی پیدا نشد';
  END IF;

  DELETE FROM public.expense_participants
  WHERE expense_id IN (SELECT id FROM public.expenses WHERE trip_id=v_trip);
  DELETE FROM public.expenses WHERE trip_id=v_trip;
  DELETE FROM public.fund_contributions WHERE trip_id=v_trip;

  UPDATE public.trips
  SET opening_fund=0, updated_at=now()
  WHERE id=v_trip;
END $$;

NOTIFY pgrst, 'reload schema';
