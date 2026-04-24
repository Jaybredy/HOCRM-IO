-- Phase 1: fix fragile property-to-hotel linkage
-- Before: has_hotel_access() joined hotels.name = properties.name (brittle)
-- After: properties.hotel_id FK makes the linkage explicit and rename-safe
--
-- Pre-flight (2026-04-20): 1 hotel, 0 properties, 0 orphans, 0 duplicate names.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE;

-- Backfill from name match (no-op today since properties is empty, but idempotent)
UPDATE properties p
   SET hotel_id = h.id
  FROM hotels h
 WHERE h.name = p.name
   AND p.hotel_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_properties_hotel_id ON properties(hotel_id);

-- Rewrite helper functions to use FK instead of name join
CREATE OR REPLACE FUNCTION public.has_hotel_access(p_hotel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1
        FROM public.user_property_access upa
        JOIN public.properties p ON p.id = upa.property_id
       WHERE upa.user_email = public.current_user_email()
         AND p.hotel_id = p_hotel_id
         AND upa.is_active = true
         AND (upa.expires_at IS NULL OR upa.expires_at > now())
    );
$function$;

CREATE OR REPLACE FUNCTION public.has_hotel_write_access(p_hotel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1
        FROM public.user_property_access upa
        JOIN public.properties p ON p.id = upa.property_id
       WHERE upa.user_email = public.current_user_email()
         AND p.hotel_id = p_hotel_id
         AND upa.is_active = true
         AND (upa.expires_at IS NULL OR upa.expires_at > now())
         AND upa.access_level IN ('EDIT', 'MANAGE')
    );
$function$;
