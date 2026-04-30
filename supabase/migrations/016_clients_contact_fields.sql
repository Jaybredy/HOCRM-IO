-- Audit 010 missed the Clients form. Create New Client Profile dialog
-- (Clients.jsx, BLANK_FORM) sends contact_person, email, phone, address,
-- property_type, and property_id — none of which existed on the table.
-- 015 already covered activity_type. This adds the remaining fields.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS contact_person  TEXT,
  ADD COLUMN IF NOT EXISTS email           TEXT,
  ADD COLUMN IF NOT EXISTS phone           TEXT,
  ADD COLUMN IF NOT EXISTS address         TEXT,
  ADD COLUMN IF NOT EXISTS property_type   TEXT,
  ADD COLUMN IF NOT EXISTS property_id     UUID;
