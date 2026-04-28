-- Add the missing other_source_details column on activity_logs
-- Frontend (ActivityLogForm.jsx) sends this field when source='other';
-- without the column, every Log Activity submission fails with PGRST204.

ALTER TABLE activity_logs
  ADD COLUMN IF NOT EXISTS other_source_details TEXT;
