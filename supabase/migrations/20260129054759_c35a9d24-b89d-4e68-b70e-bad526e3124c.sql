-- Create storage bucket for customer documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-documents', 'customer-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create customer_documents table FIRST
CREATE TABLE public.customer_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  
  -- Optional: link to specific customer (null = general knowledge)
  customer_id UUID REFERENCES public.sales_companies(id) ON DELETE SET NULL,
  
  -- File info
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  storage_path TEXT NOT NULL,
  
  -- Extracted content
  extracted_text TEXT,
  extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
  extraction_error TEXT,
  
  -- Metadata
  document_type TEXT,
  title TEXT,
  summary TEXT,
  tags TEXT[],
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for customer_documents table
CREATE POLICY "Users can view documents from their company"
ON public.customer_documents FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert documents for their company"
ON public.customer_documents FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
  AND uploaded_by = auth.uid()
);

CREATE POLICY "Users can update documents from their company"
ON public.customer_documents FOR UPDATE
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete documents from their company"
ON public.customer_documents FOR DELETE
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Index for fast lookups
CREATE INDEX idx_customer_documents_company ON public.customer_documents(company_id);
CREATE INDEX idx_customer_documents_customer ON public.customer_documents(customer_id);

-- Trigger for updated_at
CREATE TRIGGER update_customer_documents_updated_at
  BEFORE UPDATE ON public.customer_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- NOW create storage RLS policies (table exists now)
CREATE POLICY "Users can upload customer documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'customer-documents');

CREATE POLICY "Users can view customer documents from their company"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'customer-documents' AND
  EXISTS (
    SELECT 1 FROM public.customer_documents cd
    JOIN public.profiles p ON p.company_id = cd.company_id
    WHERE p.id = auth.uid()
    AND cd.storage_path = name
  )
);

CREATE POLICY "Users can delete customer documents from their company"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'customer-documents' AND
  EXISTS (
    SELECT 1 FROM public.customer_documents cd
    JOIN public.profiles p ON p.company_id = cd.company_id
    WHERE p.id = auth.uid()
    AND cd.storage_path = name
  )
);