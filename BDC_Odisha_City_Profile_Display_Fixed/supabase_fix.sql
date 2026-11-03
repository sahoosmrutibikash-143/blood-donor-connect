-- Blood Donor Connect: authentication + RLS repair for the current schema.
-- Run this in Supabase SQL Editor. Do NOT run older schema files from previous builds.

-- 1) Remove the old donor-profile trigger that inserted incomplete rows.
drop trigger if exists create_donor_profile_trigger on public.profiles;

-- 2) Rebuild the auth.users trigger so profiles and donor_profiles are created atomically.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text;
  donor_blood_group text;
  donor_city text;
  donor_last_donation date;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'role', 'patient');
  if requested_role not in ('donor','patient','admin') then requested_role := 'patient'; end if;

  insert into public.profiles (id, full_name, email, mobile, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name','User'), new.email, coalesce(new.raw_user_meta_data ->> 'mobile',new.phone), requested_role::public.user_role)
  on conflict (id) do update set full_name=excluded.full_name,email=excluded.email,mobile=excluded.mobile,role=excluded.role;

  if requested_role = 'donor' then
    donor_blood_group := nullif(new.raw_user_meta_data ->> 'blood_group','');
    donor_city := nullif(new.raw_user_meta_data ->> 'city','');
    donor_last_donation := nullif(new.raw_user_meta_data ->> 'last_donation_date','')::date;
    if donor_blood_group is null or donor_city is null then
      raise exception 'Donor blood group and city are required';
    end if;
    insert into public.donor_profiles (user_id,blood_group,city,availability,emergency_available,last_donation_date)
    values (new.id,donor_blood_group,donor_city,false,false,donor_last_donation)
    on conflict (user_id) do update set blood_group=excluded.blood_group,city=excluded.city,last_donation_date=excluded.last_donation_date;
  end if;
  return new;
end;
$$;

-- Keep the auth.users trigger. Recreate only if its name is the one used by the current project.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- 3) RLS for donor profiles. The SECURITY DEFINER trigger handles initial insert.
alter table public.donor_profiles enable row level security;
drop policy if exists donor_profiles_select_own on public.donor_profiles;
drop policy if exists donor_profiles_update_own on public.donor_profiles;
drop policy if exists donor_profiles_insert_own on public.donor_profiles;
drop policy if exists donor_profiles_admin_all on public.donor_profiles;
create policy donor_profiles_select_own on public.donor_profiles for select to authenticated using (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.status='active'));
create policy donor_profiles_update_own on public.donor_profiles for update to authenticated using (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.status='active')) with check (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.status='active'));

-- 4) Blood requests: patients can create/read/update their own requests; admins can manage all.
alter table public.blood_requests enable row level security;
drop policy if exists blood_requests_patient_select on public.blood_requests;
drop policy if exists blood_requests_patient_insert on public.blood_requests;
drop policy if exists blood_requests_patient_update on public.blood_requests;
drop policy if exists blood_requests_admin_all on public.blood_requests;
create policy blood_requests_patient_select on public.blood_requests for select to authenticated using (patient_id=auth.uid() or exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.status='active'));
create policy blood_requests_patient_insert on public.blood_requests for insert to authenticated with check (patient_id=auth.uid());
create policy blood_requests_patient_update on public.blood_requests for update to authenticated using (patient_id=auth.uid() or exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.status='active')) with check (patient_id=auth.uid() or exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.status='active'));

-- 5) Secure donor search: expose only non-sensitive fields through a SECURITY DEFINER RPC.
create or replace function public.find_available_donors(p_blood_group text, p_city text default '')
returns table (blood_group text, city text, availability boolean)
language sql
security definer
set search_path = public
as $$
  select dp.blood_group, dp.city, dp.availability
  from public.donor_profiles dp
  where dp.blood_group = p_blood_group
    and dp.availability = true
    and (nullif(trim(p_city),'') is null or dp.city ilike '%' || trim(p_city) || '%')
  order by dp.city
  limit 50;
$$;
grant execute on function public.find_available_donors(text,text) to authenticated;

-- 6) Admin read access to inventory.
alter table public.blood_inventory enable row level security;
drop policy if exists blood_inventory_admin_select on public.blood_inventory;
create policy blood_inventory_admin_select on public.blood_inventory for select to authenticated using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.status='active'));
