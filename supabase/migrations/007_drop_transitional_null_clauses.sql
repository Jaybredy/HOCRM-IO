-- Phase 6 follow-up: drop transitional `hotel_id IS NULL` escape hatches
-- from clients_insert, tasks_insert, and goals_insert.
--
-- Phase 4/6 left these clauses in place so existing UI insert flows didn't
-- break before the frontend was updated to pass hotel_id explicitly.
-- That update landed in src/api/base44Client.js (injectHotelIdIfMissing
-- intercepts inserts on clients/tasks/goals/bd_leads and auto-fills
-- hotel_id from user_property_access), so the transitional clauses are
-- no longer needed.
--
-- After this migration, non-admin inserts on these tables MUST include a
-- hotel_id the caller has write access to.

-- clients
DROP POLICY IF EXISTS clients_insert ON clients;
CREATE POLICY clients_insert ON clients FOR INSERT TO authenticated
WITH CHECK (
  is_admin()
  OR ((hotel_id IS NOT NULL) AND has_hotel_write_access(hotel_id))
);

-- tasks
DROP POLICY IF EXISTS tasks_insert ON tasks;
CREATE POLICY tasks_insert ON tasks FOR INSERT TO authenticated
WITH CHECK (
  is_admin()
  OR ((hotel_id IS NOT NULL) AND has_hotel_write_access(hotel_id))
);

-- goals
DROP POLICY IF EXISTS goals_insert ON goals;
CREATE POLICY goals_insert ON goals FOR INSERT TO authenticated
WITH CHECK (
  is_admin()
  OR ((hotel_id IS NOT NULL) AND has_hotel_write_access(hotel_id))
);
