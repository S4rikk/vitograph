-- Migration for Phase 27: Supabase Storage for Nail Photos
-- Run this in the Supabase SQL Editor
-- 1. Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('nail_photos', 'nail_photos', true) ON CONFLICT (id) DO
UPDATE
SET public = true;
-- 2. Drop existing policies to avoid conflicts if re-running
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own photos" ON storage.objects;
-- 3. Create access policies for the 'nail_photos' bucket
-- Allow public viewing of photos
CREATE POLICY "Public Access" ON storage.objects FOR
SELECT USING (bucket_id = 'nail_photos');
-- Allow authenticated users to insert/upload photos
CREATE POLICY "Authenticated users can upload photos" ON storage.objects FOR
INSERT TO authenticated WITH CHECK (bucket_id = 'nail_photos');
-- Allow authenticated users to update their own photos
CREATE POLICY "Users can update own photos" ON storage.objects FOR
UPDATE TO authenticated USING (
        bucket_id = 'nail_photos'
        AND auth.uid()::text = (storage.foldername(name)) [1]
    );
-- Allow authenticated users to delete their own photos
CREATE POLICY "Users can delete own photos" ON storage.objects FOR DELETE TO authenticated USING (
    bucket_id = 'nail_photos'
    AND auth.uid()::text = (storage.foldername(name)) [1]
);