-- Phase 5: privatize attachments bucket (closes C4)
--
-- Before: attachments bucket public=true; "Allow public reads on attachments"
--   storage.objects policy let any HTTP client read any file by URL. Files
--   uploaded as flat `<timestamp>_<filename>` — easily guessable. Hard
--   cross-tenant data leak (e.g., a hotel's GRC xlsx readable by anyone).
--
-- After: bucket public=false. Reads/uploads gated by RLS that parses the
--   hotel_id from a `hotels/<uuid>/...` path prefix and validates the
--   caller's hotel access via has_hotel_access / has_hotel_write_access.
--
-- Pre-flight: 8 existing files in flat namespace (`<timestamp>_test-uma-grc-sample.xlsx`).
--   These are leftover XLSX import test files; they remain in the bucket
--   but become readable only by admin (service role / is_admin()), which is
--   acceptable since they're synthetic test data.
--
-- Frontend (base44Client.UploadFile) is updated in the same change to
-- write under `hotels/<hotel_id>/<timestamp>_<filename>` and return a
-- short-TTL signed URL instead of a permanent public URL.

UPDATE storage.buckets SET public = false WHERE id = 'attachments';

DROP POLICY IF EXISTS "Allow public reads on attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads"        ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads"      ON storage.objects;

-- Read: admin OR file is under hotels/<hotel_id>/... and caller has_hotel_access
CREATE POLICY "attachments_select_hotel_scoped"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'attachments' AND (
    public.is_admin()
    OR (
      (split_part(name, '/', 1) = 'hotels')
      AND public.has_hotel_access(NULLIF(split_part(name, '/', 2), '')::uuid)
    )
  )
);

-- Insert: admin OR uploading under hotels/<hotel_id>/... where caller has_hotel_write_access
CREATE POLICY "attachments_insert_hotel_scoped"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'attachments' AND (
    public.is_admin()
    OR (
      (split_part(name, '/', 1) = 'hotels')
      AND public.has_hotel_write_access(NULLIF(split_part(name, '/', 2), '')::uuid)
    )
  )
);

-- Update: admin OR write access to the existing path's hotel
CREATE POLICY "attachments_update_hotel_scoped"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'attachments' AND (
    public.is_admin()
    OR (
      (split_part(name, '/', 1) = 'hotels')
      AND public.has_hotel_write_access(NULLIF(split_part(name, '/', 2), '')::uuid)
    )
  )
);

-- Delete: admin only (avoids accidental data loss by hotel staff)
CREATE POLICY "attachments_delete_admin_only"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'attachments' AND public.is_admin());
