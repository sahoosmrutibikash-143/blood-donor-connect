# Blood Donor Connect — fixed build

## Run
1. Run `supabase_fix.sql` once in Supabase SQL Editor.
2. Make sure Email/Password is enabled in Supabase Authentication.
3. If Confirm email is enabled, users must confirm their email before login.
4. Open the folder with VS Code Live Server; do not use `file://`.

## Important
- The browser uses only the Supabase publishable key. Never put a service-role key in frontend code.
- A donor signup stores donor fields in Supabase Auth metadata. The `handle_new_user` trigger then creates both `profiles` and `donor_profiles` in the same signup transaction. This fixes the database error caused by the old trigger inserting a donor row without required blood group/city values.
- The project uses the current `blood_requests` schema: patient_id, blood_group, units_required, hospital_name, city, priority, status, required_date, additional_notes.

## Admin access and database security
- Use `supabase_admin_security_fix.sql` once in the Supabase SQL Editor. It preserves existing tables and rows, prevents public signup from assigning the admin role, and adds active-admin checks to admin RPCs.
- Admin login now uses Supabase Email/Password authentication and checks `profiles.role = 'admin'` plus `profiles.status = 'active'`.
- To promote a trusted existing account to admin, first create that account through the normal signup flow, then run this owner-only SQL after replacing the email:

```sql
UPDATE public.profiles
SET role = 'admin'::public.user_role,
    status = 'active'::public.account_status,
    updated_at = now()
WHERE lower(email) = lower('YOUR_ADMIN_EMAIL');
```

- Do not expose a service-role key in the browser. Keep using the publishable key in `js/supabase.js`.
- Run the site through VS Code Live Server, not by opening HTML with `file://`.


## Blood request workflow safety patch
- `supabase_workflow_safety_patch.sql` is an optional, additive patient-request safeguard. Review it before running it in the Supabase SQL Editor.
- It prevents patient accounts from changing request status, priority, patient ownership, blood group, or units after submission. Patients can still update request logistics and notes. Active admins retain their existing workflow.
- This patch does not modify the admin login, credentials, admin role, admin dashboard functions, or existing records.
- Donor availability is self-reported and is not medical clearance. Blood-bank personnel must verify eligibility, screening, compatibility, stock and final issue. The app's donor search is an exact recorded blood-group match only, not a transfusion compatibility decision.
- Do not expose a Supabase service-role key in browser code.


## All-India location update
- City selectors now include a broader set of major Indian cities, while retaining an Other / not listed option where present.
- Patient hospital/blood-bank field offers searchable suggestions for selected major facilities across India and still permits free-text entry. This is not a complete verified national facility directory.
- Map previews search the selected city or typed/selected facility in India using Google Maps embeds. They are map previews, not verified live donor GPS or inventory feeds.
