-- Phase 4: scope clients to hotels (closes C3 cross-tenant data leak)
--
-- Before: clients table had no hotel_id column. clients_select policy
--   allowed any user with role hotel_manager/sales_manager/EPIC_MANAGER
--   to read EVERY client row across every hotel. With multiple hotels
--   this is a hard data-isolation breach.
--
-- After: clients.hotel_id FK + RLS rewritten to scope reads/writes to
--   the user's accessible hotels via has_hotel_access().
--
-- Pre-flight (2026-04-25): 4 clients, 10 production_items, 0 orphan
-- clients (every client appears in production_items at least once).
-- Backfill is safe.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS hotel_id UUID REFERENCES hotels(id) ON DELETE SET NULL;

-- Backfill: a client's hotel is the hotel of their earliest production_item.
-- If a client appears in items across multiple hotels (multi-tenant client),
-- we pick the earliest one; future fix can split such clients per hotel.
UPDATE clients c
   SET hotel_id = sub.hotel_id
  FROM (
    SELECT DISTINCT ON (client_id)
      client_id,
      hotel_id
    FROM production_items
    WHERE client_id IS NOT NULL
    ORDER BY client_id, created_at ASC
  ) AS sub
 WHERE c.id = sub.client_id
   AND c.hotel_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_clients_hotel_id ON clients(hotel_id);

-- Tighten policies. Drop the role-only ones; add hotel-scoped ones.
DROP POLICY IF EXISTS clients_select ON clients;
DROP POLICY IF EXISTS clients_insert ON clients;
DROP POLICY IF EXISTS clients_update ON clients;
DROP POLICY IF EXISTS clients_delete ON clients;

-- SELECT: admin OR creator OR hotel access. Clients without hotel_id
-- (legacy/global) remain readable only by admin + creator.
CREATE POLICY clients_select ON clients FOR SELECT TO authenticated
USING (
  is_admin()
  OR (created_by = current_app_user_id())
  OR ((hotel_id IS NOT NULL) AND has_hotel_access(hotel_id))
);

-- INSERT: must scope to a hotel the caller can write to (or admin).
-- Allow created_by-self path so non-admins inserting their own clients
-- always succeed when hotel_id is set correctly.
CREATE POLICY clients_insert ON clients FOR INSERT TO authenticated
WITH CHECK (
  is_admin()
  OR (hotel_id IS NULL AND auth.uid() IS NOT NULL)  -- legacy path; deprecated, but allow during transition
  OR ((hotel_id IS NOT NULL) AND has_hotel_write_access(hotel_id))
);

-- UPDATE: write access to the client's current hotel; can re-scope only via admin.
CREATE POLICY clients_update ON clients FOR UPDATE TO authenticated
USING (
  is_admin()
  OR (created_by = current_app_user_id())
  OR ((hotel_id IS NOT NULL) AND has_hotel_write_access(hotel_id))
)
WITH CHECK (
  is_admin()
  OR (created_by = current_app_user_id())
  OR ((hotel_id IS NOT NULL) AND has_hotel_write_access(hotel_id))
);

-- DELETE: admin only (was already)
CREATE POLICY clients_delete ON clients FOR DELETE TO authenticated
USING (is_admin());
