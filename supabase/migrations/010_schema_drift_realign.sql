-- Consolidated schema-drift fix from 2026-04-28 audit.
-- See .audit/schema-drift-report.md for the per-table findings.
--
-- Strategy: additive only. Add the columns that frontend forms send but
-- the live DB doesn't have. Drop NOT NULL on columns the frontend never
-- sends so inserts stop failing on 23502. Legacy columns (with the
-- "wrong" names) stay in place — they're nullable and unused.

-- ====================================================================
-- activity_logs
-- ====================================================================
ALTER TABLE activity_logs
  ADD COLUMN IF NOT EXISTS arrival_date          DATE,
  ADD COLUMN IF NOT EXISTS departure_date        DATE,
  ADD COLUMN IF NOT EXISTS potential_revenue     NUMERIC,
  ADD COLUMN IF NOT EXISTS next_action           TEXT,
  ADD COLUMN IF NOT EXISTS next_action_date      DATE;

-- ====================================================================
-- catering_events — 16 fields the form sends
-- ====================================================================
ALTER TABLE catering_events
  ADD COLUMN IF NOT EXISTS contact_person      TEXT,
  ADD COLUMN IF NOT EXISTS contact_email       TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone       TEXT,
  ADD COLUMN IF NOT EXISTS event_type          TEXT,
  ADD COLUMN IF NOT EXISTS setup_time          TEXT,
  ADD COLUMN IF NOT EXISTS start_time          TEXT,
  ADD COLUMN IF NOT EXISTS end_time            TEXT,
  ADD COLUMN IF NOT EXISTS venue_space         TEXT,
  ADD COLUMN IF NOT EXISTS menu_style          TEXT,
  ADD COLUMN IF NOT EXISTS menu_notes          TEXT,
  ADD COLUMN IF NOT EXISTS beverage_package    TEXT,
  ADD COLUMN IF NOT EXISTS estimated_revenue   NUMERIC,
  ADD COLUMN IF NOT EXISTS fb_revenue          NUMERIC,
  ADD COLUMN IF NOT EXISTS av_revenue          NUMERIC,
  ADD COLUMN IF NOT EXISTS decor_revenue       NUMERIC,
  ADD COLUMN IF NOT EXISTS other_revenue       NUMERIC,
  ADD COLUMN IF NOT EXISTS seller_name         TEXT,
  ADD COLUMN IF NOT EXISTS client_name         TEXT;

-- ====================================================================
-- production_items
-- ====================================================================
ALTER TABLE production_items
  ADD COLUMN IF NOT EXISTS booking_name        TEXT,
  ADD COLUMN IF NOT EXISTS documents           JSONB,
  ADD COLUMN IF NOT EXISTS peak_rooms          NUMERIC;
-- form sometimes omits departure_date when only arrival is known
ALTER TABLE production_items
  ALTER COLUMN client_id DROP NOT NULL;

-- ====================================================================
-- rfps — form is keyed by company, not event
-- ====================================================================
ALTER TABLE rfps
  ADD COLUMN IF NOT EXISTS company_name           TEXT,
  ADD COLUMN IF NOT EXISTS contact_person         TEXT,
  ADD COLUMN IF NOT EXISTS contact_email          TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone          TEXT,
  ADD COLUMN IF NOT EXISTS seller_name            TEXT,
  ADD COLUMN IF NOT EXISTS potential_room_nights  NUMERIC,
  ADD COLUMN IF NOT EXISTS about_account          TEXT,
  ADD COLUMN IF NOT EXISTS submission_date        DATE,
  ADD COLUMN IF NOT EXISTS response_date          DATE,
  ADD COLUMN IF NOT EXISTS seasons                JSONB;
ALTER TABLE rfps ALTER COLUMN event_name DROP NOT NULL;

-- ====================================================================
-- bd_team_members
-- ====================================================================
ALTER TABLE bd_team_members
  ADD COLUMN IF NOT EXISTS email      TEXT,
  ADD COLUMN IF NOT EXISTS phone      TEXT,
  ADD COLUMN IF NOT EXISTS status     TEXT,
  ADD COLUMN IF NOT EXISTS hire_date  DATE,
  ADD COLUMN IF NOT EXISTS notes      TEXT;
ALTER TABLE bd_team_members ALTER COLUMN name DROP NOT NULL;
-- hotel_id stays NOT NULL — frontend will inject it via base44Client.

-- ====================================================================
-- team_notes
-- ====================================================================
ALTER TABLE team_notes
  ADD COLUMN IF NOT EXISTS title                 TEXT,
  ADD COLUMN IF NOT EXISTS related_entity_id     UUID,
  ADD COLUMN IF NOT EXISTS related_entity_type   TEXT;
ALTER TABLE team_notes ALTER COLUMN content DROP NOT NULL;

-- ====================================================================
-- lease_renewals
-- ====================================================================
ALTER TABLE lease_renewals
  ADD COLUMN IF NOT EXISTS proposed_monthly_rent       NUMERIC,
  ADD COLUMN IF NOT EXISTS proposed_lease_start_date   DATE,
  ADD COLUMN IF NOT EXISTS proposed_lease_end_date     DATE;
-- unit_id! and renewal_status! stay NOT NULL — required by business logic.

-- ====================================================================
-- sales_targets
-- ====================================================================
ALTER TABLE sales_targets
  ADD COLUMN IF NOT EXISTS period_type                  TEXT,
  ADD COLUMN IF NOT EXISTS period_value                 TEXT,
  ADD COLUMN IF NOT EXISTS target_room_nights           NUMERIC,
  ADD COLUMN IF NOT EXISTS target_definite_room_nights  NUMERIC,
  ADD COLUMN IF NOT EXISTS target_definite_revenue      NUMERIC;
ALTER TABLE sales_targets ALTER COLUMN period DROP NOT NULL;

-- ====================================================================
-- budgets
-- ====================================================================
ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS year                          INTEGER,
  ADD COLUMN IF NOT EXISTS month                         INTEGER,
  ADD COLUMN IF NOT EXISTS group_budget_room_nights      NUMERIC,
  ADD COLUMN IF NOT EXISTS group_budget_revenue          NUMERIC,
  ADD COLUMN IF NOT EXISTS bt_budget_room_nights         NUMERIC,
  ADD COLUMN IF NOT EXISTS bt_budget_revenue             NUMERIC,
  ADD COLUMN IF NOT EXISTS budget_marketing_spend        NUMERIC,
  ADD COLUMN IF NOT EXISTS budget_room_nights            NUMERIC,
  ADD COLUMN IF NOT EXISTS budget_revenue                NUMERIC;
ALTER TABLE budgets ALTER COLUMN name   DROP NOT NULL;
ALTER TABLE budgets ALTER COLUMN amount DROP NOT NULL;

-- ====================================================================
-- service_pricing
-- ====================================================================
ALTER TABLE service_pricing
  ADD COLUMN IF NOT EXISTS service_type   TEXT,
  ADD COLUMN IF NOT EXISTS price          NUMERIC;
ALTER TABLE service_pricing ALTER COLUMN service_name DROP NOT NULL;
ALTER TABLE service_pricing ALTER COLUMN base_price   DROP NOT NULL;

-- ====================================================================
-- bd_budgets
-- ====================================================================
ALTER TABLE bd_budgets
  ADD COLUMN IF NOT EXISTS year                  INTEGER,
  ADD COLUMN IF NOT EXISTS month                 INTEGER,
  ADD COLUMN IF NOT EXISTS seller_name           TEXT,
  ADD COLUMN IF NOT EXISTS budget_leads          NUMERIC,
  ADD COLUMN IF NOT EXISTS budget_signed_deals   NUMERIC,
  ADD COLUMN IF NOT EXISTS budget_revenue        NUMERIC,
  ADD COLUMN IF NOT EXISTS budget_services       NUMERIC,
  ADD COLUMN IF NOT EXISTS forecast_leads        NUMERIC,
  ADD COLUMN IF NOT EXISTS forecast_signed_deals NUMERIC,
  ADD COLUMN IF NOT EXISTS forecast_revenue      NUMERIC;
ALTER TABLE bd_budgets ALTER COLUMN category DROP NOT NULL;
ALTER TABLE bd_budgets ALTER COLUMN amount   DROP NOT NULL;

-- ====================================================================
-- activity_goals — DEFERRED
-- The form's per-activity-type model fundamentally differs from the
-- table's single-activity-per-row model. Needs design review before
-- migrating; not changing here.
-- ====================================================================
