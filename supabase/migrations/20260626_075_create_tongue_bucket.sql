-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('tongue_photos', 'tongue_photos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable RLS policies for tongue_photos

-- Policy: Allow public read access (since we use getPublicUrl)
CREATE POLICY "Public Access for tongue_photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'tongue_photos');

-- Policy: Allow authenticated users to upload files to their own folder
CREATE POLICY "Authenticated users can upload to tongue_photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'tongue_photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Allow authenticated users to update their own files
CREATE POLICY "Authenticated users can update their tongue_photos" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'tongue_photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Allow authenticated users to delete their own files
CREATE POLICY "Authenticated users can delete their tongue_photos" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'tongue_photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
