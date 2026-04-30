-- Clients form (Create New Client Profile dialog) sends `activity_type`,
-- but the DB column was missing. PostgREST returns
-- "Could not find the 'activity_type' column of 'clients' in the schema cache".
-- Field is also rendered by ClientProfileHeader, ClientReport, and
-- ClientProfileMock, so the form's intent is correct — just realign schema.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS activity_type TEXT;
