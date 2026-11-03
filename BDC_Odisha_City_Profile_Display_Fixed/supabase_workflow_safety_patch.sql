-- Blood Donor Connect: patient request workflow safeguards.
-- ADDITIVE PATCH: does not alter admin login, admin credentials, admin role,
-- admin dashboard functions, tables, or existing records.
-- Review this file before running it in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.guard_patient_blood_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  -- Keep trusted server-side/service-role operations unaffected.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Active administrators retain the existing management workflow.
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.patient_id <> auth.uid() THEN
      RAISE EXCEPTION 'You can only create requests for your own account'
        USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'patient'
        AND p.status = 'active'
    ) THEN
      RAISE EXCEPTION 'An active patient account is required'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.units_required IS NULL OR NEW.units_required < 1 OR NEW.units_required > 20 THEN
      RAISE EXCEPTION 'Units required must be between 1 and 20';
    END IF;

    IF NEW.blood_group NOT IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') THEN
      RAISE EXCEPTION 'Invalid blood group';
    END IF;

    RETURN NEW;
  END IF;

  -- Patients may update logistics/notes, but cannot rewrite the clinical
  -- request, change its priority, impersonate another patient, or self-fulfil it.
  IF OLD.patient_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only update your own requests'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.patient_id IS DISTINCT FROM OLD.patient_id
     OR NEW.blood_group IS DISTINCT FROM OLD.blood_group
     OR NEW.units_required IS DISTINCT FROM OLD.units_required
     OR NEW.priority IS DISTINCT FROM OLD.priority
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Request status and clinical details can only be changed by authorised blood bank staff'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_patient_blood_request_trigger ON public.blood_requests;
CREATE TRIGGER guard_patient_blood_request_trigger
BEFORE INSERT OR UPDATE ON public.blood_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_patient_blood_request();

-- The donor's availability is self-reported, not medical clearance.
-- Eligibility, donor screening, compatibility and final issue remain the
-- responsibility of authorised blood-bank personnel.
