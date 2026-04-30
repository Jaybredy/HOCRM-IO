-- Units form (Units.jsx, BLANK_FORM) sends rental fields that don't exist
-- on the table. The form has shipped without ever working — every Create
-- Unit attempt 400s with PGRST204 and the dialog has no onError handler so
-- the user sees a silent freeze. Surfaced in B-7.c (form-vs-schema drift).
--
-- Form sends:                              Schema before                Schema after
--   hotel_id      UUID                      MISSING                      ADD
--   unit_number   TEXT                      EXISTS                       (no change)
--   unit_type     TEXT                      named `type`                 ADD `unit_type` (keep `type` for back-compat)
--   status        TEXT                      EXISTS                       (no change)
--   monthly_rent  NUMERIC                   MISSING                      ADD
--   current_resident_id UUID                MISSING                      ADD (loose ref to clients.id)
--   lease_start_date DATE                   MISSING                      ADD
--   lease_end_date  DATE                    MISSING                      ADD
--   notes          TEXT                     MISSING                      ADD
ALTER TABLE units
  ADD COLUMN IF NOT EXISTS hotel_id            UUID,
  ADD COLUMN IF NOT EXISTS unit_type           TEXT,
  ADD COLUMN IF NOT EXISTS monthly_rent        NUMERIC,
  ADD COLUMN IF NOT EXISTS current_resident_id UUID,
  ADD COLUMN IF NOT EXISTS lease_start_date    DATE,
  ADD COLUMN IF NOT EXISTS lease_end_date      DATE,
  ADD COLUMN IF NOT EXISTS notes               TEXT;

-- Backfill: copy `type` → `unit_type` for any existing rows.
UPDATE units SET unit_type = type WHERE unit_type IS NULL AND type IS NOT NULL;

-- Backfill: derive hotel_id from properties.hotel_id where property_id is set.
UPDATE units u
SET hotel_id = p.hotel_id
FROM public.properties p
WHERE u.property_id = p.id AND u.hotel_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_units_hotel_id ON units(hotel_id);
CREATE INDEX IF NOT EXISTS idx_units_current_resident_id ON units(current_resident_id);
