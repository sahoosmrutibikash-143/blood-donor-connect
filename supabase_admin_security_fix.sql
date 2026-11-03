-- Blood Donor Connect: security and role-safe profile trigger repair.
-- Run in Supabase SQL Editor as project owner. This migration does not drop tables or delete data.

-- 1) A public signup must NEVER be able to create an administrator account.
-- Admin accounts must be provisioned manually by the project owner (see README).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  requested_role text;
  donor_blood_group text;
  donor_city text;
  donor_last_donation date;
  patient_blood_group text;
  patient_city text;
BEGIN
  requested_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'patient');

  IF requested_role NOT IN ('donor', 'patient') THEN
    RAISE EXCEPTION 'Invalid public signup role';
  END IF;

  INSERT INTO public.profiles (id, full_name, email, mobile, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'mobile', NEW.phone),
    requested_role::public.user_role
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    mobile = EXCLUDED.mobile,
    role = EXCLUDED.role;

  IF requested_role = 'donor' THEN
    donor_blood_group := NULLIF(NEW.raw_user_meta_data ->> 'blood_group', '');
    donor_city := NULLIF(NEW.raw_user_meta_data ->> 'city', '');
    donor_last_donation := NULLIF(NEW.raw_user_meta_data ->> 'last_donation_date', '')::date;

    IF donor_blood_group IS NULL OR donor_city IS NULL THEN
      RAISE EXCEPTION 'Donor blood group and city are required';
    END IF;

    INSERT INTO public.donor_profiles
      (user_id, blood_group, city, availability, emergency_available, last_donation_date)
    VALUES (NEW.id, donor_blood_group, donor_city, false, false, donor_last_donation)
    ON CONFLICT (user_id) DO UPDATE SET
      blood_group = EXCLUDED.blood_group,
      city = EXCLUDED.city,
      last_donation_date = EXCLUDED.last_donation_date;
  ELSIF requested_role = 'patient' THEN
    patient_blood_group := NULLIF(NEW.raw_user_meta_data ->> 'blood_group', '');
    patient_city := NULLIF(NEW.raw_user_meta_data ->> 'city', '');

    IF patient_blood_group IS NULL OR patient_city IS NULL THEN
      RAISE EXCEPTION 'Patient blood group and city are required';
    END IF;

    INSERT INTO public.patient_profiles (user_id, blood_group, city)
    VALUES (NEW.id, patient_blood_group, patient_city)
    ON CONFLICT (user_id) DO UPDATE SET
      blood_group = EXCLUDED.blood_group,
      city = EXCLUDED.city;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Every SECURITY DEFINER admin RPC verifies the caller's active admin role.
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE result json;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;

  SELECT json_build_object(
    'donors', (SELECT COUNT(*) FROM public.profiles WHERE role = 'donor'),
    'patients', (SELECT COUNT(*) FROM public.profiles WHERE role = 'patient'),
    'requests', (SELECT COUNT(*) FROM public.blood_requests),
    'emergency', (SELECT COUNT(*) FROM public.blood_requests WHERE priority = 'emergency')
  ) INTO result;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_donors()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE result json;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;

  SELECT json_agg(json_build_object(
    'full_name', p.full_name,
    'email', p.email,
    'mobile', p.mobile,
    'status', p.status,
    'blood_group', d.blood_group,
    'city', d.city,
    'availability', d.availability,
    'emergency_available', d.emergency_available,
    'last_donation_date', d.last_donation_date
  ) ORDER BY p.full_name)
  INTO result
  FROM public.profiles p
  JOIN public.donor_profiles d ON d.user_id = p.id
  WHERE p.role = 'donor';

  RETURN COALESCE(result, '[]'::json);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_patients()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE result json;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;

  SELECT json_agg(json_build_object(
    'full_name', p.full_name,
    'email', p.email,
    'mobile', p.mobile,
    'status', p.status,
    'blood_group', pp.blood_group,
    'city', pp.city
  ) ORDER BY p.full_name)
  INTO result
  FROM public.profiles p
  LEFT JOIN public.patient_profiles pp ON pp.user_id = p.id
  WHERE p.role = 'patient';

  RETURN COALESCE(result, '[]'::json);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_requests()
RETURNS TABLE(
  id uuid,
  patient_id uuid,
  blood_group text,
  units_required integer,
  hospital_name text,
  city text,
  priority public.request_priority,
  status public.request_status,
  required_date date,
  additional_notes text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT br.id, br.patient_id, br.blood_group, br.units_required,
         br.hospital_name, br.city, br.priority, br.status,
         br.required_date, br.additional_notes, br.created_at, br.updated_at
  FROM public.blood_requests br
  ORDER BY br.created_at DESC
  LIMIT 20;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_inventory()
RETURNS TABLE(
  id uuid,
  blood_bank_id uuid,
  blood_group text,
  units_available integer,
  units_reserved integer,
  last_updated timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT bi.id, bi.blood_bank_id, bi.blood_group,
         bi.units_available, bi.units_reserved, bi.last_updated
  FROM public.blood_inventory bi
  ORDER BY bi.blood_group ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_request_status(
  p_request_id uuid,
  p_status public.request_status
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  current_status public.request_status;
  request_blood_group text;
  request_units integer;
  inventory_id uuid;
  available_units integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;

  SELECT br.status, br.blood_group, br.units_required
  INTO current_status, request_blood_group, request_units
  FROM public.blood_requests br
  WHERE br.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN false; END IF;
  IF current_status = p_status THEN RETURN true; END IF;

  IF current_status = 'fulfilled' THEN
    RAISE EXCEPTION 'A fulfilled request cannot be changed.';
  END IF;
  IF current_status IN ('rejected', 'cancelled') THEN
    RAISE EXCEPTION 'This request is already % and cannot be changed.', current_status;
  END IF;

  IF p_status = 'fulfilled' THEN
    SELECT bi.id, bi.units_available
    INTO inventory_id, available_units
    FROM public.blood_inventory bi
    WHERE bi.blood_group = request_blood_group
    ORDER BY bi.last_updated ASC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No inventory record found for blood group %.', request_blood_group;
    END IF;
    IF available_units < request_units THEN
      RAISE EXCEPTION 'Not enough % blood available. Required: %, Available: %.',
        request_blood_group, request_units, available_units;
    END IF;

    UPDATE public.blood_inventory
    SET units_available = units_available - request_units,
        last_updated = now()
    WHERE id = inventory_id;
  END IF;

  UPDATE public.blood_requests
  SET status = p_status, updated_at = now()
  WHERE id = p_request_id;

  RETURN FOUND;
END;
$function$;

-- 3) Restrict RPC execution to authenticated users. Admin functions still enforce is_admin internally.
REVOKE ALL ON FUNCTION public.admin_dashboard_stats() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_dashboard_donors() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_dashboard_patients() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_dashboard_requests() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_dashboard_inventory() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_request_status(uuid, public.request_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_donors() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_patients() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_inventory() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_request_status(uuid, public.request_status) TO authenticated;

REVOKE ALL ON FUNCTION public.find_available_donors(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_available_donors(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Done. No existing rows or tables are deleted by this migration.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
