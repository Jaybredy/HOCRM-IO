-- protect_role_changes_trigger calls is_admin() which checks auth.uid().
-- The update-user-role edge function uses the service role key, where
-- auth.uid() is NULL — so is_admin() returns false and the trigger blocks
-- legitimate role changes. The edge function already enforces ROLE_HIERARCHY
-- and self-edit prevention, so service_role can safely bypass.
--
-- Surfaced 2026-04-30 during Tier 1 B-6 (role-change propagation test):
--   admin clicks Change → Hotel Manager in /UserManagement →
--   alert "Failed to update role: Only admins can change user roles".
CREATE OR REPLACE FUNCTION public.protect_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Service role calls bypass — the edge function does its own role-hierarchy
    -- and self-edit checks before invoking us.
    IF current_user = 'service_role' OR session_user = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only admins can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
