-- v14.0: مدیر کنترل فعال/غیرفعال بودن تسویه نهایی
-- اجرای یک‌باره در Supabase SQL Editor

alter table public.trips add column if not exists settlement_enabled boolean not null default false;

-- فقط مدیر سفر باید بتواند این مقدار را تغییر دهد. RLS موجود جدول trips این موضوع را enforce می‌کند.
comment on column public.trips.settlement_enabled is 'Controls whether members can view final settlement; default false, enabled by trip admin at end of trip.';

notify pgrst, 'reload schema';
