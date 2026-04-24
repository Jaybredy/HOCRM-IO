-- Phase 2: drop duplicate permissive RLS policies
-- Postgres RLS is OR-combined across policies for the same command. When an
-- old "qual: true" policy coexists with a new scoped policy, the permissive
-- one wins and RLS effectively grants full access.
--
-- This migration drops the broken duplicates from 001_create_hotels.sql and
-- the live-DB-only legacy policies on users.

-- === hotels table ===
-- Before: 4 permissive (qual=true) + 4 scoped policies → any authed user could CRUD all hotels
-- After:  only the 4 scoped policies remain
DROP POLICY IF EXISTS "Authenticated users can create hotels"  ON hotels;
DROP POLICY IF EXISTS "Authenticated users can delete hotels"  ON hotels;
DROP POLICY IF EXISTS "Authenticated users can update hotels"  ON hotels;
DROP POLICY IF EXISTS "Hotels are readable by authenticated users" ON hotels;

-- === users table ===
-- Before: users_select with qual=true → every authed user could enumerate all user rows
--         "Admins can read all users" also qual=true (redundant broken)
--         "Users can read own profile" — correctly scoped, keep it
DROP POLICY IF EXISTS users_select               ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;

-- New SELECT: self, admins, or peers sharing a property
-- (hotel_manager can see co-workers at their hotels; no cross-hotel enumeration)
CREATE POLICY users_select_scoped ON users FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR email = public.current_user_email()
  OR EXISTS (
    SELECT 1
      FROM public.user_property_access self_upa
      JOIN public.user_property_access peer_upa
        ON peer_upa.property_id = self_upa.property_id
     WHERE self_upa.user_email = public.current_user_email()
       AND peer_upa.user_email = users.email
       AND self_upa.is_active
       AND peer_upa.is_active
  )
);

-- === users INSERT ===
-- Before: users_insert_admin had `is_admin() OR auth.uid() IS NOT NULL` → any authed user could insert
-- After:  admin-only. Edge functions use service_role which bypasses RLS anyway.
DROP POLICY IF EXISTS users_insert_admin ON users;
CREATE POLICY users_insert_admin ON users FOR INSERT TO authenticated
WITH CHECK (public.is_admin());
