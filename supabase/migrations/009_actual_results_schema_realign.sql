-- Realign actual_results table with what the frontend ActualResultsManager
-- form actually sends. Same class of bug as activity_logs (migration 008):
-- the live schema was built for a different concept (period-aggregate hotel
-- metrics) than the UI (per-initiative actualized results with projected vs
-- actual comparisons).
--
-- Frontend payload (per ActualResultsManager.jsx):
--   result_type, account_name, description, date_signed, start_date,
--   end_date, projected_room_nights, projected_revenue, actual_room_nights,
--   actual_revenue, marketing_spend, seller_name, status, notes
--
-- Existing aggregate columns (period/rooms_sold/revenue/adr/occupancy_rate)
-- stay nullable to preserve any future use; only `period` was NOT NULL,
-- making every insert fail before we even hit the missing-column issue.
--
-- Pre-flight: 0 rows in actual_results — safe to relax constraint.

ALTER TABLE actual_results ALTER COLUMN period DROP NOT NULL;

ALTER TABLE actual_results
  ADD COLUMN IF NOT EXISTS result_type           TEXT,
  ADD COLUMN IF NOT EXISTS account_name          TEXT,
  ADD COLUMN IF NOT EXISTS description           TEXT,
  ADD COLUMN IF NOT EXISTS date_signed           DATE,
  ADD COLUMN IF NOT EXISTS start_date            DATE,
  ADD COLUMN IF NOT EXISTS end_date              DATE,
  ADD COLUMN IF NOT EXISTS projected_room_nights INTEGER,
  ADD COLUMN IF NOT EXISTS projected_revenue     NUMERIC,
  ADD COLUMN IF NOT EXISTS actual_room_nights    INTEGER,
  ADD COLUMN IF NOT EXISTS actual_revenue        NUMERIC,
  ADD COLUMN IF NOT EXISTS marketing_spend       NUMERIC,
  ADD COLUMN IF NOT EXISTS seller_name           TEXT,
  ADD COLUMN IF NOT EXISTS status                TEXT,
  ADD COLUMN IF NOT EXISTS notes                 TEXT;

CREATE INDEX IF NOT EXISTS idx_actual_results_hotel_id   ON actual_results(hotel_id);
CREATE INDEX IF NOT EXISTS idx_actual_results_result_type ON actual_results(result_type);
