-- Trip Cost PWA - Supabase/PostgreSQL schema
-- Amounts are stored in Toman as BIGINT (no floating point money).

create extension if not exists pgcrypto;

create type public.trip_member_role as enum ('member','admin');
create type public.record_status as enum ('pending','approved','rejected');
create type public.expense_category as enum ('food','accommodation','transport','fuel','shopping','entertainment','sightseeing','medical','other');
create type public.contribution_method as enum ('cash','card','bank_transfer','other');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  destination text,
  start_date date,
  end_date date,
  currency text not null default 'تومان',
  opening_fund bigint not null default 0 check (opening_fund >= 0),
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.trip_members (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  role public.trip_member_role not null default 'member',
  share_weight numeric(8,3) not null default 1 check (share_weight > 0),
  contribution_target bigint not null default 0 check (contribution_target >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, id),
  unique (trip_id, user_id)
);

-- Each expense is submitted by a logged-in user. The payer may be another member or the shared fund.
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  expense_date date not null default current_date,
  title text not null,
  category public.expense_category not null default 'other',
  amount bigint not null check (amount >= 0),
  from_fund boolean not null default true,
  payer_member_id bigint references public.trip_members(id) on delete restrict,
  status public.record_status not null default 'pending',
  submitted_by uuid not null references auth.users(id),
  note text,
  receipt_url text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((from_fund = true and payer_member_id is null) or (from_fund = false and payer_member_id is not null))
);

-- Participants for an expense. No per-expense weight is stored: the member's fixed share_weight is used.
create table public.expense_participants (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  trip_member_id bigint not null references public.trip_members(id) on delete restrict,
  primary key (expense_id, trip_member_id)
);

create table public.fund_contributions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  trip_member_id bigint not null references public.trip_members(id) on delete restrict,
  amount bigint not null check (amount > 0),
  method public.contribution_method not null default 'cash',
  contribution_date date not null default current_date,
  status public.record_status not null default 'pending',
  submitted_by uuid not null references auth.users(id),
  note text,
  receipt_url text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  description text,
  category text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  map_url text,
  suggested_duration_minutes integer check (suggested_duration_minutes is null or suggested_duration_minutes > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_closed boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  title text not null,
  location_id uuid references public.locations(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (poll_id, user_id)
);

create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  item_date date not null,
  start_time time,
  end_time time,
  title text not null,
  description text,
  location_id uuid references public.locations(id) on delete set null,
  sort_order integer not null default 0,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.album_photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id),
  storage_path text not null,
  caption text,
  taken_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null,
  category text,
  assigned_to uuid references auth.users(id) on delete set null,
  is_completed boolean not null default false,
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  type text not null default 'info',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  trip_id uuid references public.trips(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Helpful indexes
create index idx_trip_members_trip on public.trip_members(trip_id);
create index idx_expenses_trip_status on public.expenses(trip_id, status);
create index idx_expenses_trip_date on public.expenses(trip_id, expense_date desc);
create index idx_expense_participants_member on public.expense_participants(trip_member_id);
create index idx_contributions_trip_status on public.fund_contributions(trip_id, status);
create index idx_contributions_member_status on public.fund_contributions(trip_member_id, status);
create index idx_locations_trip on public.locations(trip_id);
create index idx_polls_trip on public.polls(trip_id);
create index idx_poll_options_poll on public.poll_options(poll_id);
create index idx_poll_votes_poll on public.poll_votes(poll_id);
create index idx_itinerary_trip_date on public.itinerary_items(trip_id, item_date, sort_order);
create index idx_notifications_user on public.notifications(user_id, is_read, created_at desc);
create index idx_audit_trip on public.audit_logs(trip_id, created_at desc);

-- Basic integrity: an expense participant and payer must belong to the same trip.
create or replace function public.validate_expense_participant_trip()
returns trigger language plpgsql as $$
declare expense_trip uuid; member_trip uuid;
begin
  select trip_id into expense_trip from public.expenses where id = new.expense_id;
  select trip_id into member_trip from public.trip_members where id = new.trip_member_id;
  if expense_trip is null or member_trip is null or expense_trip <> member_trip then
    raise exception 'Expense participant must belong to the same trip as the expense';
  end if;
  return new;
end; $$;
create trigger trg_validate_expense_participant_trip
before insert or update on public.expense_participants
for each row execute function public.validate_expense_participant_trip();

create or replace function public.validate_expense_payer_trip()
returns trigger language plpgsql as $$
declare member_trip uuid;
begin
  if new.payer_member_id is not null then
    select trip_id into member_trip from public.trip_members where id = new.payer_member_id;
    if member_trip is null or member_trip <> new.trip_id then
      raise exception 'Expense payer must belong to the same trip';
    end if;
  end if;
  return new;
end; $$;
create trigger trg_validate_expense_payer_trip
before insert or update on public.expenses
for each row execute function public.validate_expense_payer_trip();

create or replace function public.validate_contribution_member_trip()
returns trigger language plpgsql as $$
declare member_trip uuid;
begin
  select trip_id into member_trip from public.trip_members where id = new.trip_member_id;
  if member_trip is null or member_trip <> new.trip_id then
    raise exception 'Contribution member must belong to the same trip';
  end if;
  return new;
end; $$;
create trigger trg_validate_contribution_member_trip
before insert or update on public.fund_contributions
for each row execute function public.validate_contribution_member_trip();

-- Role helper. Trip-level admin is determined from trip_members, not from a client-side flag.
create or replace function public.is_trip_admin(p_trip_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.trip_members tm
    where tm.trip_id = p_trip_id
      and tm.user_id = auth.uid()
      and tm.role = 'admin'
      and tm.active = true
  );
$$;

create or replace function public.is_trip_member(p_trip_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.trip_members tm
    where tm.trip_id = p_trip_id
      and tm.user_id = auth.uid()
      and tm.active = true
  );
$$;

-- Financial views. Pending/rejected records are deliberately excluded from balances.
create or replace view public.trip_financial_summary as
select
  t.id as trip_id,
  t.opening_fund
    + coalesce((select sum(fc.amount) from public.fund_contributions fc where fc.trip_id=t.id and fc.status='approved'),0)
    - coalesce((select sum(e.amount) from public.expenses e where e.trip_id=t.id and e.status='approved' and e.from_fund=true),0)
    as current_fund_balance,
  coalesce((select sum(e.amount) from public.expenses e where e.trip_id=t.id and e.status='approved'),0) as approved_expenses,
  coalesce((select sum(fc.amount) from public.fund_contributions fc where fc.trip_id=t.id and fc.status='approved'),0) as approved_contributions,
  coalesce((select sum(fc.amount) from public.fund_contributions fc where fc.trip_id=t.id and fc.status='pending'),0) as pending_contributions,
  coalesce((select sum(e.amount) from public.expenses e where e.trip_id=t.id and e.status='pending'),0) as pending_expenses
from public.trips t;

create or replace view public.member_financial_summary as
select
  tm.id as trip_member_id,
  tm.trip_id,
  tm.name,
  tm.share_weight,
  tm.contribution_target,
  coalesce((select sum(fc.amount) from public.fund_contributions fc where fc.trip_member_id=tm.id and fc.status='approved'),0) as approved_contributions,
  greatest(tm.contribution_target - coalesce((select sum(fc.amount) from public.fund_contributions fc where fc.trip_member_id=tm.id and fc.status='approved'),0),0) as fund_claim,
  coalesce((select sum(e.amount) from public.expenses e where e.payer_member_id=tm.id and e.status='approved' and e.from_fund=false),0) as direct_paid,
  coalesce((select sum(e.amount * tm.share_weight / nullif(ep.total_weight,0))
            from public.expenses e
            join public.expense_participants x on x.expense_id=e.id and x.trip_member_id=tm.id
            join lateral (select sum(tm2.share_weight) total_weight
                          from public.expense_participants x2
                          join public.trip_members tm2 on tm2.id=x2.trip_member_id
                          where x2.expense_id=e.id) ep on true
            where e.status='approved'),0) as calculated_share
from public.trip_members tm;

-- RLS
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_participants enable row level security;
alter table public.fund_contributions enable row level security;
alter table public.locations enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.album_photos enable row level security;
alter table public.checklist_items enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select_own on public.profiles for select using (auth.uid()=user_id);
create policy profiles_insert_own on public.profiles for insert with check (auth.uid()=user_id);
create policy profiles_update_own on public.profiles for update using (auth.uid()=user_id) with check (auth.uid()=user_id);

create policy trips_select_member on public.trips for select using (public.is_trip_member(id));
create policy trips_insert_authenticated on public.trips for insert with check (auth.uid()=created_by);
create policy trips_update_admin on public.trips for update using (public.is_trip_admin(id)) with check (public.is_trip_admin(id));
create policy trips_delete_admin on public.trips for delete using (public.is_trip_admin(id));

create policy members_select_member on public.trip_members for select using (public.is_trip_member(trip_id));
create policy members_insert_admin on public.trip_members for insert with check (public.is_trip_admin(trip_id));
create policy members_update_admin on public.trip_members for update using (public.is_trip_admin(trip_id)) with check (public.is_trip_admin(trip_id));
create policy members_delete_admin on public.trip_members for delete using (public.is_trip_admin(trip_id));

-- Everyone in the trip can view pending/approved/rejected expenses. Only admins can mutate after submission.
create policy expenses_select_member on public.expenses for select using (public.is_trip_member(trip_id));
create policy expenses_insert_member on public.expenses for insert with check (public.is_trip_member(trip_id) and auth.uid()=submitted_by and status='pending');
create policy expenses_update_admin on public.expenses for update using (public.is_trip_admin(trip_id)) with check (public.is_trip_admin(trip_id));
create policy expenses_delete_admin on public.expenses for delete using (public.is_trip_admin(trip_id));

create policy expense_participants_select_member on public.expense_participants for select using (
  exists (select 1 from public.expenses e where e.id=expense_id and public.is_trip_member(e.trip_id))
);
create policy expense_participants_insert_member on public.expense_participants for insert with check (
  exists (select 1 from public.expenses e where e.id=expense_id and public.is_trip_member(e.trip_id) and e.status='pending')
);
create policy expense_participants_update_admin on public.expense_participants for update using (
  exists (select 1 from public.expenses e where e.id=expense_id and public.is_trip_admin(e.trip_id))
);
create policy expense_participants_delete_admin on public.expense_participants for delete using (
  exists (select 1 from public.expenses e where e.id=expense_id and public.is_trip_admin(e.trip_id))
);

create policy contributions_select_member on public.fund_contributions for select using (public.is_trip_member(trip_id));
create policy contributions_insert_member on public.fund_contributions for insert with check (public.is_trip_member(trip_id) and auth.uid()=submitted_by and status='pending');
create policy contributions_update_admin on public.fund_contributions for update using (public.is_trip_admin(trip_id)) with check (public.is_trip_admin(trip_id));
create policy contributions_delete_admin on public.fund_contributions for delete using (public.is_trip_admin(trip_id));

create policy locations_select_member on public.locations for select using (public.is_trip_member(trip_id));
create policy locations_insert_member on public.locations for insert with check (public.is_trip_member(trip_id) and auth.uid()=created_by);
create policy locations_update_admin on public.locations for update using (public.is_trip_admin(trip_id));
create policy locations_delete_admin on public.locations for delete using (public.is_trip_admin(trip_id));

create policy polls_select_member on public.polls for select using (public.is_trip_member(trip_id));
create policy polls_insert_admin on public.polls for insert with check (public.is_trip_admin(trip_id) and auth.uid()=created_by);
create policy polls_update_admin on public.polls for update using (public.is_trip_admin(trip_id));
create policy polls_delete_admin on public.polls for delete using (public.is_trip_admin(trip_id));

create policy poll_options_select_member on public.poll_options for select using (
  exists (select 1 from public.polls p where p.id=poll_id and public.is_trip_member(p.trip_id))
);
create policy poll_options_insert_admin on public.poll_options for insert with check (
  exists (select 1 from public.polls p where p.id=poll_id and public.is_trip_admin(p.trip_id))
);
create policy poll_options_update_admin on public.poll_options for update using (
  exists (select 1 from public.polls p where p.id=poll_id and public.is_trip_admin(p.trip_id))
);
create policy poll_options_delete_admin on public.poll_options for delete using (
  exists (select 1 from public.polls p where p.id=poll_id and public.is_trip_admin(p.trip_id))
);

create policy poll_votes_select_member on public.poll_votes for select using (
  exists (select 1 from public.polls p where p.id=poll_id and public.is_trip_member(p.trip_id))
);
create policy poll_votes_insert_member on public.poll_votes for insert with check (
  auth.uid()=user_id and exists (
    select 1 from public.polls p where p.id=poll_id and public.is_trip_member(p.trip_id)
      and p.is_closed=false and (p.ends_at is null or p.ends_at > now())
  )
);
create policy poll_votes_delete_own on public.poll_votes for delete using (auth.uid()=user_id);

create policy itinerary_select_member on public.itinerary_items for select using (public.is_trip_member(trip_id));
create policy itinerary_insert_admin on public.itinerary_items for insert with check (public.is_trip_admin(trip_id) and auth.uid()=created_by);
create policy itinerary_update_admin on public.itinerary_items for update using (public.is_trip_admin(trip_id));
create policy itinerary_delete_admin on public.itinerary_items for delete using (public.is_trip_admin(trip_id));

create policy album_select_member on public.album_photos for select using (public.is_trip_member(trip_id));
create policy album_insert_member on public.album_photos for insert with check (public.is_trip_member(trip_id) and auth.uid()=uploaded_by);
create policy album_delete_owner_or_admin on public.album_photos for delete using (auth.uid()=uploaded_by or public.is_trip_admin(trip_id));

create policy checklist_select_member on public.checklist_items for select using (public.is_trip_member(trip_id));
create policy checklist_insert_member on public.checklist_items for insert with check (public.is_trip_member(trip_id) and auth.uid()=created_by);
create policy checklist_update_member_or_admin on public.checklist_items for update using (public.is_trip_member(trip_id));
create policy checklist_delete_admin on public.checklist_items for delete using (public.is_trip_admin(trip_id));

create policy notifications_select_own on public.notifications for select using (auth.uid()=user_id);
create policy notifications_update_own on public.notifications for update using (auth.uid()=user_id) with check (auth.uid()=user_id);

create policy audit_select_admin on public.audit_logs for select using (trip_id is not null and public.is_trip_admin(trip_id));
create policy audit_insert_authenticated on public.audit_logs for insert with check (auth.uid()=actor_id and (trip_id is null or public.is_trip_member(trip_id)));

-- Views need RLS through underlying tables; expose them only to trip members by querying the view with the app.
-- Recommended production hardening: set view owner and security_invoker depending on Supabase/Postgres version.


-- ============================================================
-- Membership requests + invite links
-- ============================================================
create table if not exists public.trip_invites (
  id bigint generated by default as identity primary key,
  trip_id bigint not null references public.trips(id) on delete cascade,
  token text not null unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.membership_requests (
  id bigint generated by default as identity primary key,
  trip_id bigint not null references public.trips(id) on delete cascade,
  invite_id bigint references public.trip_invites(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  note text,
  status public.record_status not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  requested_at timestamptz not null default now(),
  unique(trip_id, user_id)
);

create index if not exists idx_trip_invites_trip on public.trip_invites(trip_id);
create index if not exists idx_membership_requests_trip_status on public.membership_requests(trip_id,status);

alter table public.trip_invites enable row level security;
alter table public.membership_requests enable row level security;

create policy invites_select_admin on public.trip_invites for select using (public.is_trip_admin(trip_id));
create policy invites_insert_admin on public.trip_invites for insert with check (public.is_trip_admin(trip_id) and auth.uid()=created_by);
create policy invites_update_admin on public.trip_invites for update using (public.is_trip_admin(trip_id)) with check (public.is_trip_admin(trip_id));

-- A visitor with a valid active invite can read only the invite itself and submit a request.
-- The application validates the token before inserting. The INSERT policy also checks the invite.
create policy membership_requests_insert_invited on public.membership_requests for insert
with check (
  auth.uid()=user_id and status='pending' and
  exists (select 1 from public.trip_invites i
          where i.id=invite_id and i.trip_id=trip_id and i.is_active=true
            and (i.expires_at is null or i.expires_at > now()))
);

create policy membership_requests_select_own_or_admin on public.membership_requests for select
using (auth.uid()=user_id or public.is_trip_admin(trip_id));

create policy membership_requests_update_admin on public.membership_requests for update
using (public.is_trip_admin(trip_id)) with check (public.is_trip_admin(trip_id));

-- ============================================================
-- Secure RPCs for onboarding and admin workflow
-- ============================================================
create or replace function public.lookup_active_invite(p_token text)
returns table(invite_id bigint, trip_id uuid, trip_title text, expires_at timestamptz)
language sql security definer set search_path = public as $$
  select i.id, i.trip_id, t.title, i.expires_at
  from public.trip_invites i
  join public.trips t on t.id=i.trip_id
  where i.token=p_token and i.is_active=true
    and (i.expires_at is null or i.expires_at > now())
  limit 1;
$$;

grant execute on function public.lookup_active_invite(text) to anon, authenticated;

create or replace function public.create_trip_with_admin(
  p_title text,
  p_destination text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_opening_fund bigint default 0,
  p_name text default null,
  p_phone text default null,
  p_share_weight numeric default 1,
  p_contribution_target bigint default 0
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_trip uuid; v_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  v_name := coalesce(nullif(trim(p_name),''), 'مدیر سفر');
  insert into public.trips(title,destination,start_date,end_date,opening_fund,created_by)
  values(p_title,p_destination,p_start_date,p_end_date,p_opening_fund,auth.uid()) returning id into v_trip;
  insert into public.trip_members(trip_id,user_id,name,role,share_weight,contribution_target)
  values(v_trip,auth.uid(),v_name,'admin',greatest(p_share_weight,0.001),greatest(p_contribution_target,0));
  return v_trip;
end; $$;
grant execute on function public.create_trip_with_admin(text,text,date,date,bigint,text,text,numeric,bigint) to authenticated;

create or replace function public.create_trip_invite(p_trip_id uuid, p_expires_at timestamptz default null)
returns text
language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if not public.is_trip_admin(p_trip_id) then raise exception 'Admin access required'; end if;
  v_token := encode(gen_random_bytes(18),'hex');
  insert into public.trip_invites(trip_id,token,created_by,expires_at)
  values(p_trip_id,v_token,auth.uid(),p_expires_at);
  return v_token;
end; $$;
grant execute on function public.create_trip_invite(uuid,timestamptz) to authenticated;

create or replace function public.approve_membership_request(
  p_request_id bigint,
  p_name text,
  p_share_weight numeric,
  p_contribution_target bigint,
  p_role public.trip_member_role default 'member'
)
returns bigint
language plpgsql security definer set search_path = public as $$
declare r public.membership_requests%rowtype; v_member_id bigint;
begin
  select * into r from public.membership_requests where id=p_request_id for update;
  if not found then raise exception 'Membership request not found'; end if;
  if not public.is_trip_admin(r.trip_id) then raise exception 'Admin access required'; end if;
  if r.status <> 'pending' then raise exception 'Request is not pending'; end if;
  insert into public.trip_members(trip_id,user_id,name,role,share_weight,contribution_target)
  values(r.trip_id,r.user_id,coalesce(nullif(trim(p_name),''),r.full_name),p_role,greatest(p_share_weight,0.001),greatest(p_contribution_target,0))
  returning id into v_member_id;
  update public.membership_requests
  set status='approved',reviewed_by=auth.uid(),reviewed_at=now()
  where id=p_request_id;
  return v_member_id;
end; $$;
grant execute on function public.approve_membership_request(bigint,text,numeric,bigint,public.trip_member_role) to authenticated;

create or replace function public.reject_membership_request(p_request_id bigint,p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_trip uuid;
begin
  select trip_id into v_trip from public.membership_requests where id=p_request_id;
  if v_trip is null then raise exception 'Membership request not found'; end if;
  if not public.is_trip_admin(v_trip) then raise exception 'Admin access required'; end if;
  update public.membership_requests set status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),rejection_reason=p_reason where id=p_request_id and status='pending';
end; $$;
grant execute on function public.reject_membership_request(bigint,text) to authenticated;
