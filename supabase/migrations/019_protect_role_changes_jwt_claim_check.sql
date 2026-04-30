-- 018 tried to bypass protect_role_changes_trigger for service_role using
-- current_user / session_user, but the trigger is SECURITY DEFINER so
-- current_user is the function owner and session_user is `authenticator`
-- (the PostgREST connection role) — neither is `service_role`. Result:
-- 018 didn't actually unblock role changes.
--
-- Correct approach: read the JWT claim. Supabase puts the role in
--   request.jwt.claim.role (legacy)         and
--   request.jwt.claims.role (current via JSON setting).
-- Service-role calls have role='service_role' in the JWT.
CREATE OR REPLACE FUNCTION public.protect_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Service-role calls bypass — the update-user-role edge function
    -- already enforces ROLE_HIERARCHY, self-edit blocking, and audit log.
    IF coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
       OR coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'role' = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only admins can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
