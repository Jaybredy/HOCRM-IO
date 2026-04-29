-- ProductionForm sends seller_name. Column missing → PGRST204.
-- Audit (010) added seller_name on catering_events but missed this one
-- because the form file was different. Adding now.
ALTER TABLE production_items
  ADD COLUMN IF NOT EXISTS seller_name TEXT;
