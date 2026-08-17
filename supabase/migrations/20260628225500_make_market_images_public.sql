-- Market images are public content; writes remain protected by existing owner policies.
UPDATE storage.buckets
SET public = true
WHERE id = 'market-images';
