-- user_property_access stores user_email TEXT, not user_id UUID, so no
-- FK cascade fires when public.users or auth.users is deleted. Result:
-- orphaned grants linger and re-appear in AccessManagement (e.g. +htest3
-- still listed after the user was deleted). Fix:
--   1. Backfill: revoke any existing grants whose email no longer maps
--      to a row in public.users.
--   2. Trigger: when a public.users row is deleted, deactivate any grants
--      tied to that email. We deactivate (is_active=false) rather than
--      hard-delete so audit history is preserved.

-- Step 1: clean up existing orphans
UPDATE user_property_access upa
SET is_active = false,
    updated_at = now()
WHERE is_active = true
  AND NOT EXISTS (SELECT 1 FROM public.users u WHERE lower(u.email) = lower(upa.user_email));

-- Step 2: trigger function
CREATE OR REPLACE FUNCTION public.cascade_revoke_user_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_property_access
  SET is_active = false,
      updated_at = now()
  WHERE lower(user_email) = lower(OLD.email)
    AND is_active = true;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_revoke_user_access ON public.users;
CREATE TRIGGER trg_cascade_revoke_user_access
AFTER DELETE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.cascade_revoke_user_access();
