-- Allow all authenticated users to upload documents to their company's folder
CREATE POLICY "Users can upload company documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-documents'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text 
    FROM profiles 
    WHERE id = auth.uid()
  )
);