# Schema Drift Audit — 2026-04-28

**Trigger:** Two PGRST204 bugs hit production this week (activity_logs missing other_source_details — fixed in 008; actual_results missing 14 columns — fixed in 009). Audit identifies the remaining forms whose payloads don't match the live DB schema.

## Summary

12 forms found with schema mismatches:

- 8 tables need column ADDS (additive migration — safe)
- 5 tables have NOT NULL columns the form omits (will 23502 — needs nullable relaxation OR form fix)
- 2 tables have field-name mismatches (renames — needs frontend fix)
- 2 tables look fundamentally different from form (`activity_goals`, partial `budgets`) — flagged for design review

## Per-table findings

### activity_logs
- File: `src/components/crm/ActivityLogForm.jsx:50-62`
- Missing in DB: `arrival_date`, `departure_date`, `potential_revenue`, `next_action`, `next_action_date`
- NOT NULL the form omits: `activity_type` (form sets via `status` field — should map correctly)

### catering_events
- File: `src/components/crm/CateringEventForm.jsx:76-85`
- Missing in DB (16): `contact_person`, `contact_email`, `contact_phone`, `event_type`, `setup_time`, `start_time`, `end_time`, `venue_space`, `menu_style`, `menu_notes`, `beverage_package`, `estimated_revenue`, `fb_revenue`, `av_revenue`, `decor_revenue`, `other_revenue`, `seller_name`, `client_name`

### production_items
- File: `src/components/crm/ProductionForm.jsx:325-345`
- Missing in DB: `booking_name`, `documents`, `peak_rooms`
- NOT NULL form omits: `departure_date` — likely already handled in form when present, but optional fields will fail. Should relax to nullable.

### rfps
- File: `src/components/rfp/RFPForm.jsx:42-45`
- Missing in DB (10): `company_name`, `contact_person`, `contact_email`, `contact_phone`, `seller_name`, `potential_room_nights`, `about_account`, `submission_date`, `response_date`, `seasons`
- NOT NULL the form omits: `event_name` — relax to nullable

### bd_team_members
- File: `src/components/bd/BDTeamMembers.jsx`
- Missing in DB: `email`, `phone`, `status`, `hire_date`, `notes`
- NOT NULL the form omits: `hotel_id` — form needs hotel_id injection (covered by base44Client adapter for hotel-scoped tables, **but this table needs to be in HOTEL_SCOPED_TABLES set**)

### team_notes
- File: `src/collaboration/TeamNotes.jsx`
- Missing in DB: `title`, `related_entity_id`, `related_entity_type`

### lease_renewals
- File: `src/components/rentals/RenewalProposalForm.jsx`
- Missing in DB: `proposed_monthly_rent`, `proposed_lease_start_date`, `proposed_lease_end_date`
- NOT NULL the form omits: `unit_id`, `renewal_status` — keep current (they are required for renewals)

### sales_targets
- File: `src/components/performance/SalesTargetManager.jsx:51-60`
- Missing in DB: `period_type`, `period_value`, `target_definite_room_nights`, `target_definite_revenue`, `target_room_nights`
- Field rename: form sends `target_room_nights`, DB has `target_rooms` — adding `target_room_nights` as new column alongside; later cleanup can drop `target_rooms` if unused
- NOT NULL form omits: `period`

### budgets
- File: `src/components/performance/BudgetManager.jsx:64-73`
- Missing in DB: `year`, `month`, `group_budget_room_nights`, `group_budget_revenue`, `bt_budget_room_nights`, `bt_budget_revenue`, `budget_marketing_spend`, `budget_room_nights`, `budget_revenue`
- NOT NULL form omits: `name`, `amount` — relax both

### service_pricing
- File: `src/components/bd/ServicePricingManager.jsx`
- **Field-name mismatch**: form sends `service_type`/`price`, DB has `service_name`/`base_price`. Adding `service_type` and `price` as columns; legacy `service_name`/`base_price` stay.
- NOT NULL on `service_name`, `base_price` — relax both since form uses different names

### bd_budgets
- File: `src/components/bd/BDBudgetManager.jsx`
- Missing in DB: `year`, `month`, `seller_name`, `budget_leads`, `budget_signed_deals`, `budget_revenue`, `budget_services`, `forecast_leads`, `forecast_signed_deals`, `forecast_revenue`
- NOT NULL form omits: `category`, `amount` — relax

### activity_goals
- File: `src/components/activities/ActivityGoalsSettings.jsx`
- Form creates multiple goals per activity_type but DB has single `activity_type!` column — design mismatch. **Defer; needs separate design review.**

## Approach

Single consolidated migration (010) that:
1. ADDs all missing columns (additive, safe)
2. Drops NOT NULL on columns the frontend doesn't send (unblocks creates)
3. Skips activity_goals (design mismatch, separate fix)
4. Adds bd_team_members to base44Client's HOTEL_SCOPED_TABLES set (frontend code change)

## Frontend fix follow-up needed

- Add `bd_team_members` to `HOTEL_SCOPED_TABLES` in `base44Client.js` so hotel_id auto-fills
- Eventually: fix service_pricing field names (use `service_name`/`base_price` consistently), unify sales_targets field naming, redesign activity_goals form
