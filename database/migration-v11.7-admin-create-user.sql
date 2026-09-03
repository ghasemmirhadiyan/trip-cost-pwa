-- v11.7: admin-created username/password accounts
alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_lower_uidx on public.profiles (lower(username)) where username is not null;

create or replace function public.resolve_username(p_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_email text;
begin
  select email into v_email
  from auth.users u
  join public.profiles p on p.user_id=u.id
  where lower(p.username)=lower(trim(p_username))
  limit 1;
  return v_email;
end;
$$;
grant execute on function public.resolve_username(text) to anon, authenticated;
notify pgrst, 'reload schema';
