-- Creator-only write access to their own folder in market-images
DROP POLICY IF EXISTS "Authenticated users can upload market images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update own market images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own market images" ON storage.objects;

CREATE POLICY "Creators can upload their own market images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'market-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "Creators can update their own market images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'market-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
)
WITH CHECK (
  bucket_id = 'market-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "Creators can delete their own market images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'market-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Admins can moderate any market image
CREATE POLICY "Admins can update any market image"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'market-images' AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'market-images' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete any market image"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'market-images' AND public.has_role(auth.uid(), 'admin'::app_role));