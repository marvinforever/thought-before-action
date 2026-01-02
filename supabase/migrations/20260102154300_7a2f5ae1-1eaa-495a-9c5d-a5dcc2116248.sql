-- Create storage bucket for tutorial videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('tutorial-videos', 'tutorial-videos', true);

-- Allow anyone to view tutorial videos (public bucket)
CREATE POLICY "Tutorial videos are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'tutorial-videos');

-- Allow authenticated admins to upload tutorial videos
CREATE POLICY "Admins can upload tutorial videos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'tutorial-videos' 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (is_admin = true OR is_super_admin = true)
  )
);

-- Allow authenticated admins to update tutorial videos
CREATE POLICY "Admins can update tutorial videos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'tutorial-videos' 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (is_admin = true OR is_super_admin = true)
  )
);

-- Allow authenticated admins to delete tutorial videos
CREATE POLICY "Admins can delete tutorial videos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'tutorial-videos' 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (is_admin = true OR is_super_admin = true)
  )
);