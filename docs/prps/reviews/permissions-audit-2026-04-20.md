# Permissions Audit — 2026-04-20

**Scope:** Multi-tenant permissions in HOCRM-IO — magic-link onboarding, sub-user creation with role levels, and per-hotel data isolation.
**Method:** Read-only codebase review. Live Supabase RLS policies and Auth dashboard config were NOT inspected — findings marked "Unverified" require live DB checks.
**Repo state:** `main`, clean against `origin/main`.

## Scope & Method

Files reviewed:
- `supabase/functions/invite-user/index.ts` — invite edge function
- `supabase/functions/rbac-check/index.ts` — server-side RBAC checker
- `supabase/functions/import-uma-grc-xlsx/index.ts` — XLSX import (for tenant-scoping patterns)
- `src/pages/AuthCallback.jsx` — magic-link redirect handler
- `src/pages/UserManagement.jsx` — invite UI + role dropdown
- `src/pages/Settings.jsx`, `CRM.jsx`, `ProductionCalendar.jsx` — data-bearing pages
- `src/lib/rbac.jsx` — client-side capability map
- `src/api/base44Client.js` — Supabase adapter (previously Base44)
- `supabase/migrations/001_create_hotels.sql` — only migration file in repo

**Limitations:**
- Only one migration file (`001_create_hotels.sql`, 39 lines) exists in the repo. Schema + RLS for `users`, `production_items`, `bookings`, `clients`, `audit_logs`, `attachments` storage are live-only (Supabase dashboard or unmigrated SQL). Every RLS claim below marked ⚠️ is unverified against the live DB.
- Supabase Auth redirect URL, SMTP/Resend config, and email templates are dashboard-only — not in repo.

---

## Q1: Magic-link onboarding — findings

### Works
- ✓ `invite-user` requires a valid caller JWT (authed route)
- ✓ Creates user in Supabase Auth AND `users` table
- ✓ Returns a magic link for the inviter to share
- ✓ `AuthCallback.jsx` uses Supabase JS session correctly

### Broken / Missing
| ID | Sev | Finding | File | Fix direction |
|---|---|---|---|---|
| F024 | CRITICAL | No `hotel_id` populated on invitee's user row | `supabase/functions/invite-user/index.ts:90-109` | Add `hotel_id` column to users table; populate on insert |
| F025 | CRITICAL | Invite body has no `hotel_id`; caller's hotel not validated against invitee's hotel | `supabase/functions/invite-user/index.ts:45,52` | Require `hotel_id` param; enforce `caller.hotel_id === body.hotel_id` for non-EPIC_ADMIN |
| F026 | MEDIUM | No `pending_invites` table — no audit trail, no context retained if invitee never clicks | (missing table) | Create `pending_invites(id, email, role, hotel_id, invited_by, expires_at)` |
| F028 | MEDIUM | `AuthCallback` always hardcodes redirect to `/` — no `returnTo` support | `src/pages/AuthCallback.jsx:28` | Accept `?returnTo=` query param; validate against same-origin allowlist |

### Unverified (needs live test)
- Supabase Auth "Site URL" and "Redirect URLs" config (dashboard-only)
- Whether magic-link emails are actually sent (delivery still open per tracking issue #1)
- F027: `SUPABASE_AUTH_CALLBACK_URL` not in `.env.example`

---

## Q2: Sub-user creation & roles — findings

### Role matrix (from `src/lib/rbac.jsx` + `supabase/functions/rbac-check/index.ts`)

| Role | Capabilities | Can invite? | Scope |
|---|---|---|---|
| `EPIC_ADMIN` / `admin` | All 12 | ✓ any role | Platform-wide |
| `hotel_manager` | VIEW, CREATE, EDIT, DELETE, REPORTS, EXPORT, USER_INVITE_MANAGE, PROPERTY_SETTINGS | ✓ **any role — no hierarchy check** | (should be hotel-scoped, but not enforced) |
| `sales_manager` | VIEW, CREATE, EDIT, REPORTS | ✗ | Hotel-scoped |
| `EPIC_MANAGER` | VIEW, CREATE, EDIT, REPORTS, EXPORT | ✗ | — |
| `EPIC_CONTRIBUTOR` | VIEW, CREATE, EDIT | ✗ | — |
| `user` | Empty capabilities (added F020) | ✗ | — |

### Works
- ✓ Role string is enumerated in UI dropdown (no free-text)
- ✓ `rbac.jsx` and `rbac-check/index.ts` share the same capability map (consistency verified in F013)
- ✓ `protect_role_changes_trigger` (from F005, 2026-04-16) blocks users from editing their own role via the REST API

### Broken / Missing
| ID | Sev | Finding | File | Fix direction |
|---|---|---|---|---|
| F029 | CRITICAL | `hotel_manager` can invite with `role=EPIC_ADMIN` — no role hierarchy gate | `supabase/functions/invite-user/index.ts:45` | Server-side: reject `role >= caller.role` for non-admin callers |
| F030 | CRITICAL | Same root cause as F025 — no `hotel_id` means "invite only for own hotel" is unenforceable | `supabase/functions/invite-user/index.ts` | Depends on F024/F025 |
| F032 | HIGH | Role dropdown shows `EPIC_MANAGER`, `EPIC_CONTRIBUTOR`, `EPIC_ADMIN` to `hotel_manager` users | `src/pages/UserManagement.jsx:13-21` | Filter dropdown options by `auth.me().role` |
| F033 | HIGH | Role changes via `base44.entities.User.update(id,{role})` — direct PATCH, relies only on DB trigger | `src/pages/UserManagement.jsx:65-72` | Create `update-user-role` edge function with RBAC + audit logging |
| F031 | MEDIUM | Verify F009 fix: UI says hotel_manager can access UserManagement (`:85`) but historical review flagged mismatch — re-check | `src/pages/UserManagement.jsx:85-98` | Reconfirm F009 intent vs implementation |
| F034 | MEDIUM | No audit log emitted on role changes | `src/pages/UserManagement.jsx` | Log to `audit_logs` on every role mutation with actor, target, old, new, ts |

---

## Q3: Data isolation (RLS + frontend) — findings

### Per-table RLS status

| Table / Bucket | RLS present in repo | Policy summary | Cross-tenant risk |
|---|---|---|---|
| `hotels` | ✓ `001_create_hotels.sql:17-39` | `TO authenticated USING (true)` for ALL ops | **CRITICAL — any auth user can DELETE any hotel** (F036) |
| `production_items` | ✗ not in migrations | ⚠️ unknown (live-only) | **CRITICAL if missing hotel_id filter** (F037) |
| `users` | ✗ not in migrations | ⚠️ unknown; frontend `User.list()` returns all rows | **CRITICAL — enumerates all emails/roles** (F038) |
| `clients` | ✗ not in migrations | ⚠️ unknown; import uses no WHERE | **MEDIUM** (F040) |
| `bookings` | ✗ not in migrations | ⚠️ unknown | ⚠️ unknown |
| `audit_logs` | ✗ not in migrations | Scoped by `property_id` in rbac-check:146 | ✓ appears correct |
| `attachments` (storage) | ✗ no policy in repo | Files uploaded as `${timestamp}_${name}`; `getPublicUrl()` returns global URL | **CRITICAL — path-guessable cross-hotel read** (F039) |
| `user_property_access` | ✗ not in migrations | Filtered by `user_email` + `property_id` in rbac-check:146-160 | ✓ appears correct |

### Frontend query audit

| Issue | File | Risk |
|---|---|---|
| `base44Client.list()` does `.select('*')` with no WHERE | `src/api/base44Client.js:79-92` | Adapter cannot filter by hotel — every page depends entirely on RLS being correct (F041) |
| `ProductionItem.list()` with no filter, no LIMIT | `src/pages/CRM.jsx:93`, `src/pages/ProductionCalendar.jsx:54` | Cross-tenant leak if RLS missing; perf/scale issue (F011, F037) |
| `User.list()` with no filter | `src/pages/UserManagement.jsx:51` | All users' emails/roles exposed to anyone who renders this page (F038) |
| `base44Client.update(id, data).eq('id', id)` — no `hotel_id` scope in WHERE | `src/api/base44Client.js:121-125` | If user knows an item ID from another hotel, update may succeed unless RLS blocks (F043) |

### Works
- ✓ `audit_logs` scoping via `property_id`
- ✓ `user_property_access` correctly filtered in rbac-check
- ✓ `import-uma-grc-xlsx` was updated to filter clients by `hotel_id` (2026-04-16 fix)

### Broken / Missing
See the table above. Summary: **hotels RLS is demonstrably wrong in repo; everything else is unverified — requires a live RLS dump from Supabase dashboard.**

---

## Summary of gaps (ranked)

### CRITICAL (8) — block production
- **F036** — `hotels` RLS allows all authenticated users to INSERT/UPDATE/DELETE every hotel
- **F037** — `production_items` cross-tenant leak if live RLS missing `hotel_id` filter
- **F038** — `users` table readable by all authenticated callers (enumerates emails + roles)
- **F024** — invitees have no `hotel_id` association → downstream RLS can't filter them
- **F025** — invite-user accepts no `hotel_id` and doesn't validate caller's hotel
- **F029** — `hotel_manager` can self-escalate by inviting themselves as `EPIC_ADMIN`
- **F039** — attachments storage bucket has no per-hotel path/policy; URLs guessable
- **F040** — `clients` table may be global (no `hotel_id` column visible in code)

### HIGH (4)
- **F032** — role dropdown exposes platform-admin roles to hotel_manager
- **F033** — role changes go through raw REST, relying only on DB trigger
- **F041** — `list()` adapter has no filter support; forces `.select('*')` everywhere
- **F042** — no `hotel_id` column on users table assumed

### MEDIUM (6)
- F026 (no pending_invites), F027 (redirect URL undocumented), F028 (no returnTo validation), F031 (F009 re-verification), F034 (no audit on role changes), F043 (update adapter has no hotel scope), F044 (property_id vs hotel_id terminology), F045 (no column-level access)

---

## Recommended test plan

Run these against the live app (`hocrm-io.vercel.app`) after fixes land:

1. **Hotels RLS:** log in as `user` role, try `DELETE` via Supabase REST → expect 403
2. **hotel_manager invite scope:** invite user with different hotel_id than caller's → expect rejection
3. **Privilege escalation:** hotel_manager invites `role=EPIC_ADMIN` → expect rejection
4. **Users enumeration:** log in as `user`, visit UserManagement → expect 403 / empty list
5. **Hotel deletion:** only `EPIC_ADMIN` succeeds on DELETE
6. **Attachment isolation:** upload as Hotel A, try to read URL as Hotel B → expect 403
7. **Magic-link onboarding:** invitee clicks link → lands on dashboard scoped to invited hotel only
8. **Production items load:** log in as Hotel A user → CRM page shows zero Hotel B rows
9. **Audit trail:** change a role → verify `audit_logs` row created with actor/target/old/new

---

## Next step recommendation

Before writing any fix code, **dump live RLS policies** so the CRITICAL-column is grounded in reality:

```bash
SUPABASE_ACCESS_TOKEN=<token> curl -s -X POST \
  "https://api.supabase.com/v1/projects/akyprqkrxbqlyrhgeubg/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT schemaname, tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = '\''public'\'' ORDER BY tablename, policyname;"}'
```

Then a `users` schema dump:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='users';
```

Results will confirm which of F037/F038/F040/F042 are real vs already mitigated, and the plan can narrow accordingly.

---

# Reconciliation with Live DB (2026-04-20, 2nd pass)

Live RLS policies, function bodies, storage policies, and foreign keys dumped via Supabase Management API. **Live DB is far more mature than the repo suggested** — 26 tables, all RLS-enabled, with a proper RBAC helper-function layer. But the coexistence of old+new policies and a fragile property↔hotel linkage introduce serious gaps.

## Live state overview

**26 tables with RLS enabled:** activity_goals, activity_logs, actual_results, audit_logs, bd_budgets, bd_leads, bd_team_members, budgets, catering_events, clients, contacts, goals, hotels, lease_renewals, production_items, properties, report_records, rfps, sales_targets, service_pricing, tasks, team_notes, units, user_preferences, user_property_access, users.

**Helper functions (all `SECURITY DEFINER`):**
- `is_admin()` — `role IN ('admin', 'EPIC_ADMIN')`
- `current_app_role()` — user_role of the current caller
- `current_app_user_id()` — users.id for the caller
- `current_user_email()` — email for the caller
- `has_hotel_access(hotel_id)` — via `user_property_access → properties → hotels.name` ⚠️
- `has_hotel_write_access(hotel_id)` — same, plus `access_level IN ('EDIT','MANAGE')`

**Users↔Hotels mapping is NOT a column — it's the `user_property_access` junction table** (good design; supports multi-hotel users).

## Reconciled findings

### ✅ Already correct (audit was overly cautious)

| ID | Original assertion | Live reality |
|---|---|---|
| F037 | production_items cross-tenant leak | **False** — policy `prod_select` uses `has_hotel_access(hotel_id)`; correct per design |
| F042 | No hotel_id on users table | **Design choice, not a bug** — multi-hotel via `user_property_access` |
| F011 | Unbounded SELECT on production_items | **Perf only, not leak** — RLS still filters rows server-side |

### 🔴 Confirmed CRITICAL — ground truth now

#### C1. `hotels` table — DUPLICATE policies, old permissive ones override new admin-only ones
Live DB has BOTH old and new policies coexisting:
- OLD (from `001_create_hotels.sql`): `"Authenticated users can delete hotels"` with `qual: true`
- NEW: `hotels_delete` with `is_admin()`

**Postgres RLS is OR-combined across policies for the same command.** Any authenticated user can still INSERT / UPDATE / DELETE / SELECT every hotel because the `true` policies haven't been dropped.

**Fix:** `DROP POLICY "Authenticated users can create hotels" ON hotels; DROP POLICY "Authenticated users can delete hotels" ON hotels; DROP POLICY "Authenticated users can update hotels" ON hotels; DROP POLICY "Hotels are readable by authenticated users" ON hotels;`

#### C2. `users` table — `users_select` policy with `qual: true`
Every authenticated user can SELECT every row in `users` (emails, roles, names enumerable). This coexists with narrower policies (`Users can read own profile` — correct; `Admins can read all users` — redundant `true`). The `true` one wins under OR.

**Fix:** `DROP POLICY users_select ON users; DROP POLICY "Admins can read all users" ON users;` Keep `Users can read own profile`. Add hotel_manager-scoped SELECT:
```sql
CREATE POLICY users_select_hotel_peers ON users FOR SELECT
  USING (
    is_admin()
    OR email = current_user_email()
    OR EXISTS (
      SELECT 1 FROM user_property_access peer_upa
      JOIN user_property_access self_upa ON self_upa.property_id = peer_upa.property_id
      WHERE self_upa.user_email = current_user_email()
        AND peer_upa.user_email = users.email
        AND self_upa.is_active AND peer_upa.is_active
    )
  );
```

#### C3. `clients` table has NO `hotel_id` column
`clients` is a truly global table: no `hotel_id`, no FK to hotels. Policy `clients_select` allows any `hotel_manager | sales_manager | EPIC_MANAGER` to read every client across every hotel.

**Fix (larger):** `ALTER TABLE clients ADD COLUMN hotel_id UUID REFERENCES hotels(id);` Backfill based on `production_items.client_id → production_items.hotel_id`. Tighten policies to use `has_hotel_access(hotel_id)`. Contacts inherit the problem via `contacts.client_id` join.

#### C4. `attachments` storage bucket is public + permissive policies
Bucket `public: true`, plus explicit policies:
- `"Allow public reads on attachments"` (SELECT, `bucket_id = 'attachments'`) — **any HTTP caller with a URL can read**
- `"Allow authenticated uploads"` (INSERT, no path constraint) — any authed user can upload anywhere in the bucket

Files uploaded as `${timestamp}_${filename}` (no hotel prefix). URLs are guessable by timestamp + filename.

**Fix:**
1. Set bucket `public = false`
2. Drop `"Allow public reads on attachments"`
3. Replace with path-scoped policies requiring `hotel_id` in the path and `has_hotel_access(hotel_id)` check via UUID parsing
4. Update `base44Client.js` uploader to use path `hotels/{hotel_id}/{timestamp}_{name}`
5. Replace `getPublicUrl()` with `createSignedUrl()` (short TTL)

#### C5. `has_hotel_access()` joins `hotels.name = properties.name` — FRAGILE LINKAGE
```sql
JOIN public.hotels h ON h.name = p.name   -- property-hotel linkage
```

This is the bridge between `user_property_access` (keyed by `property_id`) and all the tables scoped by `hotel_id`. A rename, typo, duplicate, or case mismatch on either side silently breaks permission checks (either over- or under-granting).

**Fix:** `ALTER TABLE properties ADD COLUMN hotel_id UUID REFERENCES hotels(id);` Backfill by name, then rewrite `has_hotel_access` to use `p.hotel_id = p_hotel_id` instead of joining on name. Add `UNIQUE(hotel_id)` constraint on properties if 1:1.

#### C6. `invite-user` — no hotel scoping and no role hierarchy (unchanged from original audit)
Still applies — the edge function accepts any role, for any hotel (or no hotel), and doesn't create a `user_property_access` row. Invitees who click the magic link land in an empty app.

### 🟠 Confirmed HIGH — new issues surfaced by live data

| ID | Issue | Details |
|---|---|---|
| H1 | `tasks` table has no hotel_id filter in SELECT | `(is_admin() OR assigned_to = self OR role IN (hotel_manager, sales_manager, EPIC_MANAGER))` — a hotel_manager at Hotel A sees Hotel B's tasks |
| H2 | `goals` table has no hotel_id in policy | Same shape as tasks — role-based without hotel scope |
| H3 | `contacts` inherits client's cross-tenant issue | Join via `client_id`; since `clients` is global, contacts are too |
| H4 | `bd_leads`, `bd_budgets`, `bd_team_members` have no hotel scoping | Pure role-based; fine if BD is platform-wide, problematic if per-hotel |
| H5 | `users_insert_admin` policy allows any authed user to INSERT | `with_check: (is_admin() OR auth.uid() IS NOT NULL)` — the OR gives any authed user insert permission. Probably intentional (for `invite-user` edge function writing to users table with service role), but worth re-checking. |

### 🟡 Confirmed MEDIUM (from original audit, still valid)

- F024/F025: invite-user doesn't populate `user_property_access` → invitees have zero hotel access
- F029: no role hierarchy check in invite-user (hotel_manager can create EPIC_ADMIN)
- F032: UI role dropdown exposes platform roles to hotel_manager
- F033: role changes bypass a dedicated edge function; rely on `protect_role_changes_trigger` for safety
- F034: no audit log on role changes
- F028: AuthCallback has no returnTo param

## Severity ranking (final)

**CRITICAL (6)** — ship-blocking
1. **C1** — hotels duplicate permissive policies (any user can destroy all hotels)
2. **C2** — users_select with `true` (email/role enumeration)
3. **C3** — clients table has no hotel_id (cross-tenant read by design)
4. **C4** — attachments public + unscoped (guessable file URLs)
5. **C5** — `has_hotel_access` joins on `name` (silent permission bugs on rename)
6. **C6** — invite-user unscoped + no role hierarchy (self-escalation, empty onboarding)

**HIGH (5)** — H1-H5 above

**MEDIUM (6)** — as listed, plus the original F028/F034

## Good news

- 26 tables with RLS enabled — no table is raw
- Helper functions are `SECURITY DEFINER` and correct in shape
- `audit_logs`, `user_property_access`, `user_preferences`, `budgets`, `catering_events`, `rfps`, `sales_targets`, `service_pricing`, `production_items`, `report_records`, `team_notes` all have correct hotel-scoped policies
- Foreign keys exist from 11 tables → `hotels(id)` — so the `hotel_id` pattern is real, just not universal yet

## Revised test plan

1. **C1 verification:** as `role=user`, `DELETE FROM hotels WHERE id=<any>;` — **currently succeeds** — should fail after drops
2. **C2 verification:** as `role=user`, `SELECT email, role FROM users;` — **currently returns all rows** — should return 1 row after drops
3. **C3 verification:** as hotel_manager of Hotel A, `SELECT * FROM clients;` — **currently returns all clients** — should filter after hotel_id added
4. **C4 verification:** upload attachment as Hotel A, GET public URL as anonymous — **currently works** — should 403 after bucket privatized
5. **C5 verification:** rename a hotel in live DB without updating property — all that hotel's data becomes invisible to its users; should not happen after FK switch
6. **C6 verification:** as hotel_manager, invite user with role=EPIC_ADMIN → currently succeeds; should fail
7. **Regression:** after fixes, hotel_manager of Hotel A still sees their own hotel's production_items, clients, budgets, etc.
8. **Onboarding:** magic link click → new user sees Hotel A data (after invite-user is fixed to populate user_property_access)
