-- Company Knowledge Base for HR policies, procedures, etc.
-- Each company can only see/query their own documents

-- Create the main knowledge base table
CREATE TABLE public.company_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT, -- Extracted text content for RAG/search
  document_type TEXT NOT NULL DEFAULT 'policy', -- policy, procedure, handbook, faq, other
  category TEXT, -- HR, Finance, Operations, IT, Legal, etc.
  file_url TEXT, -- URL to stored file if uploaded
  file_name TEXT,
  file_type TEXT, -- pdf, docx, etc.
  is_active BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_knowledge ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only view their company's knowledge
CREATE POLICY "Users can view their company knowledge"
  ON public.company_knowledge
  FOR SELECT
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- RLS: Only admins can insert knowledge
CREATE POLICY "Admins can insert company knowledge"
  ON public.company_knowledge
  FOR INSERT
  WITH CHECK (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- RLS: Only admins can update knowledge
CREATE POLICY "Admins can update company knowledge"
  ON public.company_knowledge
  FOR UPDATE
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- RLS: Only admins can delete knowledge
CREATE POLICY "Admins can delete company knowledge"
  ON public.company_knowledge
  FOR DELETE
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Index for fast company lookups
CREATE INDEX idx_company_knowledge_company_id ON public.company_knowledge(company_id);
CREATE INDEX idx_company_knowledge_category ON public.company_knowledge(category);
CREATE INDEX idx_company_knowledge_active ON public.company_knowledge(is_active) WHERE is_active = true;

-- Full-text search index on content
CREATE INDEX idx_company_knowledge_content_search ON public.company_knowledge 
  USING gin(to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(content, '')));

-- Trigger for updated_at
CREATE TRIGGER update_company_knowledge_updated_at
  BEFORE UPDATE ON public.company_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for knowledge documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-documents', 'company-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Users can view their company's documents
CREATE POLICY "Users can view company documents"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'company-documents' 
    AND (storage.foldername(name))[1] = (
      SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Storage RLS: Admins can upload to their company folder
CREATE POLICY "Admins can upload company documents"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'company-documents'
    AND (storage.foldername(name))[1] = (
      SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Storage RLS: Admins can delete their company's documents
CREATE POLICY "Admins can delete company documents"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'company-documents'
    AND (storage.foldername(name))[1] = (
      SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );