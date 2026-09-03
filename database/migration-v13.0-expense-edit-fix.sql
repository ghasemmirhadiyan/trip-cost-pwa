create or replace function public.update_expense_admin(p_expense_id uuid,p_expense_date date,p_title text,p_category public.expense_category,p_amount bigint,p_from_fund boolean,p_payer_member_id bigint default null,p_note text default null,p_participants bigint[] default '{}'::bigint[]) returns void language plpgsql security definer set search_path=public as $$
declare v_trip uuid; v_caller uuid:=auth.uid(); v_len int:=coalesce(array_length(p_participants,1),0); v_cnt int;
begin
 if v_caller is null then raise exception 'ابتدا وارد حساب شوید'; end if;
 if trim(coalesce(p_title,''))='' then raise exception 'عنوان هزینه الزامی است'; end if;
 if coalesce(p_amount,0)<=0 then raise exception 'مبلغ هزینه باید بیشتر از صفر باشد'; end if;
 select e.trip_id into v_trip from public.expenses e where e.id=p_expense_id for update;
 if v_trip is null then raise exception 'هزینه پیدا نشد'; end if;
 if not public.is_trip_admin(v_trip) then raise exception 'فقط مدیر سفر می‌تواند هزینه را ویرایش کند'; end if;
 if v_len=0 then raise exception 'حداقل یک عضو باید در هزینه سهیم باشد'; end if;
 select count(*) into v_cnt from (select distinct x from unnest(p_participants) t(x)) d;
 if v_cnt<>v_len then raise exception 'اعضای مشمول تکراری هستند'; end if;
 select count(*) into v_cnt from public.trip_members tm where tm.trip_id=v_trip and tm.active and tm.id=any(p_participants);
 if v_cnt<>v_len then raise exception 'یکی از اعضای انتخاب‌شده عضو فعال این سفر نیست'; end if;
 if p_from_fund then p_payer_member_id:=null; elsif not exists(select 1 from public.trip_members tm where tm.id=p_payer_member_id and tm.trip_id=v_trip and tm.active) then raise exception 'پرداخت‌کننده عضو فعال این سفر نیست'; end if;
 update public.expenses set expense_date=p_expense_date,title=trim(p_title),category=p_category,amount=p_amount,from_fund=p_from_fund,payer_member_id=p_payer_member_id,note=nullif(trim(coalesce(p_note,'')),''),updated_at=now() where id=p_expense_id;
 delete from public.expense_participants where expense_id=p_expense_id;
 insert into public.expense_participants(expense_id,trip_member_id) select p_expense_id,x from unnest(p_participants) t(x);
end;$$;
grant execute on function public.update_expense_admin(uuid,date,text,public.expense_category,bigint,boolean,bigint,text,bigint[]) to authenticated;
notify pgrst,'reload schema';
