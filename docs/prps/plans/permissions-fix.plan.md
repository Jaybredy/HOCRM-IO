# Permissions Fix Plan — 2026-04-20

**Inputs:** `docs/prps/reviews/permissions-audit-2026-04-20.md` (6 CRITICAL + 5 HIGH + 6 MEDIUM)

**Strategy:** Phased by dependency. Phase 1 fixes the foundation (`has_hotel_access` linkage) because every other fix relies on it being correct. Phase 2 cleans up broken-but-already-deployed policies (pure SQL, no app code). Phase 3 is the minimum set to **demo the magic-link + permission flow** the user asked about. Phases 4-5 are the remaining security hardening.

**What "landing" means here:** each phase ends with (a) a SQL migration file committed under `supabase/migrations/`, (b) that migration applied to live DB via Management API, (c) any app code changes deployed, (d) a test-plan check run.

---

## Phase 1 — Foundation: fix property↔hotel linkage (C5)

**Problem:** `has_hotel_access()` joins `hotels.name = properties.name`. Renames, typos, duplicates silently break permission checks everywhere.

**Changes:**

1. New migration `supabase/migrations/002_properties_hotel_id.sql`:
   ```sql
   ALTER TABLE properties ADD COLUMN hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE;

   -- Backfill from name match (current behavior)
   UPDATE properties p SET hotel_id = h.id
   FROM hotels h WHERE h.name = p.name AND p.hotel_id IS NULL;

   -- Rewrite helper function
   CREATE OR REPLACE FUNCTION public.has_hotel_access(p_hotel_id uuid)
   RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
     SELECT public.is_admin() OR EXISTS (
       SELECT 1 FROM public.user_property_access upa
       JOIN public.properties p ON p.id = upa.property_id
       WHERE upa.user_email = public.current_user_email()
         AND p.hotel_id = p_hotel_id
         AND upa.is_active = true
         AND (upa.expires_at IS NULL OR upa.expires_at > now())
     );
   $$;

   CREATE OR REPLACE FUNCTION public.has_hotel_write_access(p_hotel_id uuid)
   RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
     SELECT public.is_admin() OR EXISTS (
       SELECT 1 FROM public.user_property_access upa
       JOIN public.properties p ON p.id = upa.property_id
       WHERE upa.user_email = public.current_user_email()
         AND p.hotel_id = p_hotel_id
         AND upa.is_active = true
         AND (upa.expires_at IS NULL OR upa.expires_at > now())
         AND upa.access_level IN ('EDIT', 'MANAGE')
     );
   $$;

   CREATE INDEX IF NOT EXISTS idx_properties_hotel_id ON properties(hotel_id);
   ```

2. **Pre-flight check before running:** verify every property has a matching hotel by name; flag any orphans.

   ```sql
   SELECT p.id, p.name FROM properties p
   LEFT JOIN hotels h ON h.name = p.name
   WHERE h.id IS NULL;
   ```

**Risk:** if backfill leaves any `properties.hotel_id` NULL, those properties' users lose access. Mitigated by pre-flight check + manual fix before migration.

**Test:** as a logged-in user, verify they still see their hotel's production_items (RLS unchanged, just foundation swapped).

---

## Phase 2 — RLS cleanup: drop duplicate permissive policies (C1, C2, H5)

**Problem:** old `qual: true` policies from `001_create_hotels.sql` coexist with new scoped ones. RLS is OR-combined → permissive wins.

**Changes:**

1. Migration `supabase/migrations/003_drop_permissive_policies.sql`:
   ```sql
   -- C1: hotels table
   DROP POLICY IF EXISTS "Authenticated users can create hotels" ON hotels;
   DROP POLICY IF EXISTS "Authenticated users can delete hotels" ON hotels;
   DROP POLICY IF EXISTS "Authenticated users can update hotels" ON hotels;
   DROP POLICY IF EXISTS "Hotels are readable by authenticated users" ON hotels;

   -- C2: users table
   DROP POLICY IF EXISTS users_select ON users;
   DROP POLICY IF EXISTS "Admins can read all users" ON users;

   -- Replace with hotel-peers-aware SELECT
   CREATE POLICY users_select_scoped ON users FOR SELECT TO authenticated
   USING (
     is_admin()
     OR email = current_user_email()
     OR EXISTS (
       SELECT 1 FROM user_property_access self_upa
       JOIN user_property_access peer_upa ON peer_upa.property_id = self_upa.property_id
       WHERE self_upa.user_email = current_user_email()
         AND peer_upa.user_email = users.email
         AND self_upa.is_active AND peer_upa.is_active
     )
   );

   -- H5: tighten users INSERT (only admins + invite-user edge function via service role)
   DROP POLICY IF EXISTS users_insert_admin ON users;
   CREATE POLICY users_insert_admin ON users FOR INSERT TO authenticated
   WITH CHECK (is_admin());
   -- invite-user edge function uses service_role which bypasses RLS; unaffected
   ```

**Risk:** if any live code paths depend on non-admin INSERT to users, they'll break. Only known writer is `invite-user` edge function which uses service role → bypasses RLS.

**Test plan:** C1/C2 manual test from audit's test plan (1 & 2).

---

## Phase 3 — MINIMUM TESTABLE: magic-link onboarding + role gating (C6, F029, F032)

**This is the phase that answers the user's original question.** After Phase 3 lands, the end-to-end flow can be demo'd:

1. Admin invites a new user → picks hotel + role → magic link sent
2. User clicks link → lands in app → sees only their hotel's data
3. Invitee with `hotel_manager` role cannot invite someone as `EPIC_ADMIN`

**Changes:**

### 3a. Edge function: `invite-user` hardening
File: `supabase/functions/invite-user/index.ts`

- Accept `hotel_id` in request body (required for non-admin callers)
- Validate role hierarchy (**CONFIRMED 2026-04-20**):
  - `EPIC_ADMIN` / `admin` → any role
  - `EPIC_MANAGER` → `hotel_manager`, `sales_manager`, `EPIC_CONTRIBUTOR`, `user`
  - `hotel_manager` → `sales_manager`, `user` (no EPIC_* — those are platform-wide)
  - `sales_manager` / `EPIC_CONTRIBUTOR` / `user` → cannot invite (403)
- Validate caller has `has_hotel_write_access(hotel_id)` (call via RPC or inline)
- After user created, INSERT into `user_property_access`:
  ```sql
  INSERT INTO user_property_access (user_email, property_id, role_at_property, access_level, granted_by, is_active)
  VALUES (:email, :property_id, :role_at_property, :access_level, :caller_id, true);
  ```
  (note: `property_id` — need to resolve hotel_id → property_id via `SELECT id FROM properties WHERE hotel_id = ?`)

### 3b. UI: UserManagement role dropdown filter
File: `src/pages/UserManagement.jsx`

- Read `auth.me().role`
- Filter role dropdown options:
  ```js
  const roleHierarchy = {
    EPIC_ADMIN: ['EPIC_ADMIN','admin','hotel_manager','sales_manager','EPIC_MANAGER','EPIC_CONTRIBUTOR','user'],
    admin: [/* same as EPIC_ADMIN */],
    hotel_manager: ['sales_manager','EPIC_MANAGER','EPIC_CONTRIBUTOR','user'],
    // others: []
  };
  const allowedRoles = roleHierarchy[currentUser.role] ?? [];
  ```
- Also: add hotel picker (for EPIC_ADMIN only — others default to their own hotel)

### 3c. UI: AuthCallback.jsx — no change needed for core flow
Magic link already works; `user_property_access` row created by invite-user means new user has data on first login.

**Risk:** breaking existing invite flow in production. Mitigated by deploying edge function change + UI change together; roll back if issues.

**Test:** steps 6, 7, 8 from audit's test plan.

---

## Phase 4 — Clients hotel scoping (C3)

**Problem:** `clients` has no `hotel_id` → globally visible across hotels.

**Changes:**

1. Migration `supabase/migrations/004_clients_hotel_id.sql`:
   ```sql
   ALTER TABLE clients ADD COLUMN hotel_id UUID REFERENCES hotels(id);

   -- Backfill: a client's hotel is the hotel of the production_item where it first appears
   UPDATE clients c SET hotel_id = (
     SELECT hotel_id FROM production_items pi
     WHERE pi.client_id = c.id
     ORDER BY pi.created_at ASC LIMIT 1
   ) WHERE c.hotel_id IS NULL;

   -- Manual fix any leftovers, then enforce
   -- ALTER TABLE clients ALTER COLUMN hotel_id SET NOT NULL; (after verifying)

   -- Tighten policies
   DROP POLICY IF EXISTS clients_select ON clients;
   CREATE POLICY clients_select ON clients FOR SELECT TO authenticated
   USING (is_admin() OR has_hotel_access(hotel_id));

   DROP POLICY IF EXISTS clients_insert ON clients;
   CREATE POLICY clients_insert ON clients FOR INSERT TO authenticated
   WITH CHECK (is_admin() OR has_hotel_write_access(hotel_id));

   DROP POLICY IF EXISTS clients_update ON clients;
   CREATE POLICY clients_update ON clients FOR UPDATE TO authenticated
   USING (is_admin() OR has_hotel_write_access(hotel_id));

   CREATE INDEX IF NOT EXISTS idx_clients_hotel_id ON clients(hotel_id);
   ```

2. Frontend: `src/pages/*.jsx` — any `Client.create(...)` must pass `hotel_id`. Check `CRM.jsx`, import functions.

**Risk:** orphan clients (no production_items) won't get a hotel_id. Migration shows them; manual assignment or admin-only access.

---

## Phase 5 — Attachments bucket hardening (C4)

**Problem:** public bucket + guessable filenames.

**Changes:**

1. Migration `supabase/migrations/005_attachments_private.sql`:
   ```sql
   UPDATE storage.buckets SET public = false WHERE id = 'attachments';

   DROP POLICY IF EXISTS "Allow public reads on attachments" ON storage.objects;
   DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;

   -- Path-scoped read: users can read only files under hotels/{their_hotel_id}/
   CREATE POLICY "Hotel-scoped attachment reads" ON storage.objects FOR SELECT TO authenticated
   USING (
     bucket_id = 'attachments'
     AND (
       is_admin()
       OR has_hotel_access((string_to_array(name, '/'))[2]::uuid)
     )
   );

   DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
   CREATE POLICY "Hotel-scoped attachment uploads" ON storage.objects FOR INSERT TO authenticated
   WITH CHECK (
     bucket_id = 'attachments'
     AND (
       is_admin()
       OR has_hotel_write_access((string_to_array(name, '/'))[2]::uuid)
     )
   );
   ```

2. Frontend: `src/api/base44Client.js` — change upload path to `hotels/${hotel_id}/${timestamp}_${name}`, replace `getPublicUrl` with `createSignedUrl(path, 3600)`.

**Risk:** existing files in bucket not under the new path — they become orphaned. Migration should move them or admin handles manually.

**Test:** audit test step 4 (cross-hotel attachment read fails).

---

## Phase 6 — Remaining HIGH/MEDIUM

- **H1/H2:** tasks + goals hotel_id scoping — add `hotel_id` column + policy update
- **H3:** contacts policy rewrite (after clients fix is in place)
- **H4:** bd_* tables (`bd_leads`, `bd_budgets`, `bd_team_members`) — **CONFIRMED per-hotel**; add `hotel_id` column + FK + policies scoped via `has_hotel_access`
- **F033:** `update-user-role` edge function with audit log
- **F034:** audit log on role changes (covered by F033 if done together)
- **F028:** AuthCallback returnTo validation

**Recommendation:** bundle H1-H4 into a single migration after Phase 4 lands. F033+F034 as one edge function in a follow-up.

---

## Proposed execution order

| Batch | Phases | Blast radius | User testing |
|---|---|---|---|
| 1 | Phase 1 | Low — function body swap, no behavior change | Smoke test existing app |
| 2 | Phase 2 | Medium — tightens reads; may break non-admin UI paths | Log in as non-admin, verify pages load |
| 3 | **Phase 3** | Medium — invite flow changes | **Manual test: invite hotel_manager, verify scoping** |
| 4 | Phase 4 | Medium — clients query paths | Import XLSX, create client |
| 5 | Phase 5 | Medium — upload flow | Upload attachment, verify URL |
| 6 | Phase 6 | Low (H1-H3 small; H4 deferred) | Regression |

**User question the plan answers:**
> "check the magic link for a new user (hotel), and that user can create different accounts with different permission levels, and each permission level can only see the data they are allowed under that group's permissions"

✅ After Batch 3 (Phase 3), this is demo-ready. Batches 4-5 close the remaining data-leak holes (clients/attachments) but the invite+scoping flow itself works after Batch 3.

---

## What I need from you before starting

1. **Approve the plan or flag changes.** Particularly:
   - Is `hotel_manager` allowed to invite `EPIC_MANAGER`? (Current draft says yes.) What's the actual hierarchy you want?
   - Should `bd_*` tables be per-hotel (H4) or platform-wide?
   - Any tolerance for downtime? Phase 2's policy drops have a ~10-second window where things are unscoped — acceptable in low-traffic window.

2. **Supabase PAT for running migrations.** I'll use the same PAT (`sbp_bfd04af3c513bad35a4416f8841d788cb52144e4`) or a fresh one — your call. After we're done, revoke at https://supabase.com/dashboard/account/tokens.

3. **Confirm the test account** for Phase 3 demo. I'll need to invite a throwaway email and verify the flow end-to-end. Suggest you pick a non-primary email you control.
