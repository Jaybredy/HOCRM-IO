-- ProductionForm sends additional_services as a JSONB object (catering /
-- AV / extras). Column was missing → PGRST204. Adds it nullable.
ALTER TABLE production_items
  ADD COLUMN IF NOT EXISTS additional_services JSONB;
