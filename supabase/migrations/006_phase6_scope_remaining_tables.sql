-- Phase 6: scope tasks/goals/bd_*/contacts to hotels
--
-- Closes the remaining HIGH findings from the 2026-04-20 audit:
--   H1: tasks visible cross-hotel (role-based, no hotel_id filter)
--   H2: goals visible cross-hotel
--   H3: contacts inherit clients' cross-hotel issue (now closed via Phase 4)
--   H4: bd_* tables (per user direction: BD is per-hotel)
--
-- All 5 tables (tasks, goals, bd_leads, bd_budgets, bd_team_members) are
-- currently empty (verified 2026-04-25), so adding hotel_id is safe.
-- contacts is also empty; no backfill needed.

-- =====================================================================
-- 1. ADD hotel_id columns + indexes
-- =====================================================================

ALTER TABLE tasks            ADD COLUMN IF NOT EXISTS hotel_id UUID REFERENCES hotels(id) ON DELETE SET NULL;
ALTER TABLE goals            ADD COLUMN IF NOT EXISTS hotel_id UUID REFERENCES hotels(id) ON DELETE SET NULL;
ALTER TABLE bd_leads         ADD COLUMN IF NOT EXISTS hotel_id UUID REFERENCES hotels(id) ON DELETE SET NULL;
ALTER TABLE bd_budgets       ADD COLUMN IF NOT EXISTS hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE;
ALTER TABLE bd_team_members  ADD COLUMN IF NOT EXISTS hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tasks_hotel_id            ON tasks(hotel_id);
CREATE INDEX IF NOT EXISTS idx_goals_hotel_id            ON goals(hotel_id);
CREATE INDEX IF NOT EXISTS idx_bd_leads_hotel_id         ON bd_leads(hotel_id);
CREATE INDEX IF NOT EXISTS idx_bd_budgets_hotel_id       ON bd_budgets(hotel_id);
CREATE INDEX IF NOT EXISTS idx_bd_team_members_hotel_id  ON bd_team_members(hotel_id);

-- =====================================================================
-- 2. tasks — hotel-scoped + assignee fallback
-- =====================================================================
DROP POLICY IF EXISTS tasks_select ON tasks;
DROP POLICY IF EXISTS tasks_insert ON tasks;
DROP POLICY IF EXISTS tasks_update ON tasks;
DROP POLICY IF EXISTS tasks_delete ON tasks;

CREATE POLICY tasks_select ON tasks FOR SELECT TO authenticated
USING (
  is_admin()
  OR (assigned_to = current_app_user_id())
  OR ((hotel_id IS NOT NULL) AND has_hotel_access(hotel_id))
);

CREATE POLICY tasks_insert ON tasks FOR INSERT TO authenticated
WITH CHECK (
  is_admin()
  OR (hotel_id IS NULL AND auth.uid() IS NOT NULL)
  OR ((hotel_id IS NOT NULL) AND has_hotel_write_access(hotel_id))
);

CREATE POLICY tasks_update ON tasks FOR UPDATE TO authenticated
USING (
  is_admin()
  OR (assigned_to = current_app_user_id())
  OR ((hotel_id IS NOT NULL) AND has_hotel_write_access(hotel_id))
);

CREATE POLICY tasks_delete ON tasks FOR DELETE TO authenticated
USING (
  is_admin()
  OR ((hotel_id IS NOT NULL) AND has_hotel_write_access(hotel_id))
);

-- =====================================================================
-- 3. goals — hotel-scoped + assignee fallback
-- =====================================================================
DROP POLICY IF EXISTS goals_select ON goals;
DROP POLICY IF EXISTS goals_insert ON goals;
DROP POLICY IF EXISTS goals_update ON goals;
DROP POLICY IF EXISTS goals_delete ON goals;

CREATE POLICY goals_select ON goals FOR SELECT TO authenticated
USING (
  is_admin()
  OR (assigned_to = current_app_user_id())
  OR ((hotel_id IS NOT NULL) AND has_hotel_access(hotel_id))
);

CREATE POLICY goals_insert ON goals FOR INSERT TO authenticated
WITH CHECK (
  is_admin()
  OR (hotel_id IS NULL AND auth.uid() IS NOT NULL)
  OR ((hotel_id IS NOT NULL) AND has_hotel_write_access(hotel_id))
);

CREATE POLICY goals_update ON goals FOR UPDATE TO authenticated
USING (
  is_admin()
  OR (assigned_to = current_app_user_id())
  OR ((hotel_id IS NOT NULL) AND has_hotel_write_access(hotel_id))
);

CREATE POLICY goals_delete ON goals FOR DELETE TO authenticated
USING (is_admin());

-- =====================================================================
-- 4. bd_leads — hotel-scoped (per user direction: BD is per-hotel)
-- =====================================================================
DROP POLICY IF EXISTS bdlead_select ON bd_leads;
DROP POLICY IF EXISTS bdlead_insert ON bd_leads;
DROP POLICY IF EXISTS bdlead_update ON bd_leads;
DROP POLICY IF EXISTS bdlead_delete ON bd_leads;

CREATE POLICY bdlead_select ON bd_leads FOR SELECT TO authenticated
USING (
  is_admin()
  OR (assigned_to = current_app_user_id())
  OR ((hotel_id IS NOT NULL) AND has_hotel_access(hotel_id))
);

CREATE POLICY bdlead_insert ON bd_leads FOR INSERT TO authenticated
WITH CHECK (
  is_admin()
  OR ((hotel_id IS NOT NULL) AND has_hotel_write_access(hotel_id))
);

CREATE POLICY bdlead_update ON bd_leads FOR UPDATE TO authenticated
USING (
  is_admin()
  OR (assigned_to = current_app_user_id())
  OR ((hotel_id IS NOT NULL) AND has_hotel_write_access(hotel_id))
);

CREATE POLICY bdlead_delete ON bd_leads FOR DELETE TO authenticated
USING (is_admin());

-- =====================================================================
-- 5. bd_budgets — hotel-scoped, manage requires write access
-- =====================================================================
DROP POLICY IF EXISTS bdbudget_select ON bd_budgets;
DROP POLICY IF EXISTS bdbudget_modify ON bd_budgets;

CREATE POLICY bdbudget_select ON bd_budgets FOR SELECT TO authenticated
USING (
  is_admin()
  OR ((hotel_id IS NOT NULL) AND has_hotel_access(hotel_id))
);

CREATE POLICY bdbudget_modify ON bd_budgets FOR ALL TO authenticated
USING (
  is_admin()
  OR ((hotel_id IS NOT NULL) AND has_hotel_write_access(hotel_id))
)
WITH CHECK (
  is_admin()
  OR ((hotel_id IS NOT NULL) AND has_hotel_write_access(hotel_id))
);

-- =====================================================================
-- 6. bd_team_members — hotel-scoped
-- =====================================================================
DROP POLICY IF EXISTS bdteam_select ON bd_team_members;
DROP POLICY IF EXISTS bdteam_modify ON bd_team_members;

CREATE POLICY bdteam_select ON bd_team_members FOR SELECT TO authenticated
USING (
  is_admin()
  OR (user_id = current_app_user_id())
  OR ((hotel_id IS NOT NULL) AND has_hotel_access(hotel_id))
);

CREATE POLICY bdteam_modify ON bd_team_members FOR ALL TO authenticated
USING (
  is_admin()
  OR ((hotel_id IS NOT NULL) AND has_hotel_write_access(hotel_id))
)
WITH CHECK (
  is_admin()
  OR ((hotel_id IS NOT NULL) AND has_hotel_write_access(hotel_id))
);

-- =====================================================================
-- 7. contacts — inherit hotel scoping through clients.hotel_id
--    (clients was scoped in Phase 4; old contacts policy joined to
--    clients with role-based override which still leaked.)
-- =====================================================================
DROP POLICY IF EXISTS contacts_select ON contacts;
DROP POLICY IF EXISTS contacts_insert ON contacts;
DROP POLICY IF EXISTS contacts_update ON contacts;
DROP POLICY IF EXISTS contacts_delete ON contacts;

CREATE POLICY contacts_select ON contacts FOR SELECT TO authenticated
USING (
  is_admin()
  OR EXISTS (
    SELECT 1 FROM clients c
     WHERE c.id = contacts.client_id
       AND (
         c.created_by = current_app_user_id()
         OR ((c.hotel_id IS NOT NULL) AND has_hotel_access(c.hotel_id))
       )
  )
);

CREATE POLICY contacts_insert ON contacts FOR INSERT TO authenticated
WITH CHECK (
  is_admin()
  OR EXISTS (
    SELECT 1 FROM clients c
     WHERE c.id = contacts.client_id
       AND (
         c.created_by = current_app_user_id()
         OR ((c.hotel_id IS NOT NULL) AND has_hotel_write_access(c.hotel_id))
       )
  )
);

CREATE POLICY contacts_update ON contacts FOR UPDATE TO authenticated
USING (
  is_admin()
  OR EXISTS (
    SELECT 1 FROM clients c
     WHERE c.id = contacts.client_id
       AND (
         c.created_by = current_app_user_id()
         OR ((c.hotel_id IS NOT NULL) AND has_hotel_write_access(c.hotel_id))
       )
  )
);

CREATE POLICY contacts_delete ON contacts FOR DELETE TO authenticated
USING (
  is_admin()
  OR EXISTS (
    SELECT 1 FROM clients c
     WHERE c.id = contacts.client_id
       AND ((c.hotel_id IS NOT NULL) AND has_hotel_write_access(c.hotel_id))
  )
);
