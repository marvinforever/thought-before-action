
-- Add access_level column to customer_documents
ALTER TABLE public.customer_documents 
ADD COLUMN IF NOT EXISTS access_level text NOT NULL DEFAULT 'all';

-- Create document_access table for restricted documents
CREATE TABLE public.document_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.customer_documents(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, profile_id)
);

-- Enable RLS
ALTER TABLE public.document_access ENABLE ROW LEVEL SECURITY;

-- Users can view access entries for documents in their company
CREATE POLICY "Users can view document access for their company docs"
ON public.document_access
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customer_documents cd
    JOIN public.profiles p ON p.company_id = cd.company_id
    WHERE cd.id = document_access.document_id
    AND p.id = auth.uid()
  )
);

-- Document uploaders can manage access
CREATE POLICY "Uploaders can insert document access"
ON public.document_access
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.customer_documents cd
    WHERE cd.id = document_access.document_id
    AND cd.uploaded_by = auth.uid()
  )
);

CREATE POLICY "Uploaders can delete document access"
ON public.document_access
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customer_documents cd
    WHERE cd.id = document_access.document_id
    AND cd.uploaded_by = auth.uid()
  )
);
