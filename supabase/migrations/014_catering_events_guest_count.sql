-- CateringEventForm sends `guest_count`; table had `attendees` (same data,
-- legacy name). Audit 010 missed this rename. Adding `guest_count` rather
-- than renaming so any other code paths using `attendees` keep working.
ALTER TABLE catering_events
  ADD COLUMN IF NOT EXISTS guest_count INTEGER;
