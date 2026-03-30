-- Allow any authenticated user to upload to company-documents for their own company folder
CREATE POLICY "Authenticated users can upload company documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-documents'
  AND (storage.foldername(name))[1] = (SELECT profiles.company_id::text FROM profiles WHERE profiles.id = auth.uid())
);

-- Allow authenticated users to read company documents from their company folder
CREATE POLICY "Authenticated users can read company documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'company-documents'
  AND (storage.foldername(name))[1] = (SELECT profiles.company_id::text FROM profiles WHERE profiles.id = auth.uid())
);