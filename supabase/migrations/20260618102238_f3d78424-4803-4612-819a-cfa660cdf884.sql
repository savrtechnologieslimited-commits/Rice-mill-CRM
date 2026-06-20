ALTER TABLE public.paddy_batches ADD COLUMN IF NOT EXISTS storage_image_url text;

CREATE POLICY "godown_photos_auth_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'godown-photos');
CREATE POLICY "godown_photos_auth_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'godown-photos');
CREATE POLICY "godown_photos_auth_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'godown-photos');
CREATE POLICY "godown_photos_auth_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'godown-photos');