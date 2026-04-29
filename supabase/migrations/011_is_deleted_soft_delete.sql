-- Add is_deleted soft-delete flag to production_items.
-- 8 frontend call sites filter by !is_deleted (analytics, lists). Without
-- the column, server-side queries like ProductionItem.filter({ is_deleted: false })
-- 400 with PGRST204; client-side checks silently treat all rows as not-deleted.
-- Default false so historical rows look "live" until someone explicitly soft-deletes.
ALTER TABLE production_items
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_production_items_is_deleted ON production_items(is_deleted) WHERE is_deleted = false;
