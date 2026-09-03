-- Trip Cost PWA: atomic expense creation
-- Run once in Supabase SQL Editor after schema.sql
create or replace function public.create_expense_with_participants(
  p_trip_id uuid,
  p_expense_date date,
  p_title text,
  p_category public.expense_category,
  p_amount bigint,
  p_from_fund boolean,
  p_payer_member_id bigint,
  p_note text,
  p_participant_ids bigint[]
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_expense_id uuid;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'احراز هویت لازم است'; end if;
  if not public.is_trip_member(p_trip_id) then raise exception 'شما عضو این سفر نیستید'; end if;
  if p_amount <= 0 then raise exception 'مبلغ باید بیشتر از صفر باشد'; end if;
  if nullif(trim(p_title),'') is null then raise exception 'عنوان هزینه الزامی است'; end if;
  if coalesce(array_length(p_participant_ids,1),0) = 0 then raise exception 'حداقل یک شرکت‌کننده لازم است'; end if;
  if p_from_fund and p_payer_member_id is not null then raise exception 'برای پرداخت از صندوق، پرداخت‌کننده نباید مشخص شود'; end if;
  if not p_from_fund and p_payer_member_id is null then raise exception 'برای پرداخت شخصی، پرداخت‌کننده الزامی است'; end if;
  if not p_from_fund and not exists (select 1 from public.trip_members tm where tm.id=p_payer_member_id and tm.trip_id=p_trip_id and tm.active) then
    raise exception 'پرداخت‌کننده عضو فعال این سفر نیست';
  end if;
  select count(*) into v_count
  from public.trip_members tm
  where tm.trip_id=p_trip_id and tm.active and tm.id = any(p_participant_ids);
  if v_count <> array_length(p_participant_ids,1) then raise exception 'یکی از شرکت‌کنندگان عضو فعال این سفر نیست'; end if;

  insert into public.expenses(trip_id,expense_date,title,category,amount,from_fund,payer_member_id,status,submitted_by,note)
  values(p_trip_id,coalesce(p_expense_date,current_date),trim(p_title),p_category,p_amount,p_from_fund,p_payer_member_id,'pending',auth.uid(),nullif(trim(p_note),''))
  returning id into v_expense_id;

  insert into public.expense_participants(expense_id,trip_member_id)
  select v_expense_id, x from unnest(p_participant_ids) as x;

  return v_expense_id;
end;
$$;
revoke all on function public.create_expense_with_participants(uuid,date,text,public.expense_category,bigint,boolean,bigint,text,bigint[]) from public;
grant execute on function public.create_expense_with_participants(uuid,date,text,public.expense_category,bigint,boolean,bigint,text,bigint[]) to authenticated;
