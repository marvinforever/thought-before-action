-- Create table for generated prep documents
CREATE TABLE public.sales_prep_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.sales_deals(id) ON DELETE SET NULL,
  
  -- Document content
  title TEXT NOT NULL,
  prospect_name TEXT,
  prospect_company TEXT,
  prospect_role TEXT,
  call_type TEXT,
  call_objective TEXT,
  
  -- AI-generated sections
  talking_points JSONB,
  discovery_questions JSONB,
  product_recommendations JSONB,
  objection_handlers JSONB,
  next_steps TEXT,
  
  -- Sharing
  share_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  is_public BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales_prep_documents ENABLE ROW LEVEL SECURITY;

-- Users can view their own documents (profiles.id matches profile_id when the user owns that profile)
CREATE POLICY "Users can view their own prep documents"
ON public.sales_prep_documents
FOR SELECT
USING (
  profile_id IN (SELECT id FROM public.profiles WHERE id = (SELECT id FROM public.profiles WHERE id IN (SELECT id FROM public.profiles p WHERE p.email = (SELECT email FROM auth.users WHERE id = auth.uid()))))
);

-- Users can create their own documents
CREATE POLICY "Users can create their own prep documents"
ON public.sales_prep_documents
FOR INSERT
WITH CHECK (
  profile_id IN (SELECT id FROM public.profiles WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
);

-- Users can update their own documents
CREATE POLICY "Users can update their own prep documents"
ON public.sales_prep_documents
FOR UPDATE
USING (
  profile_id IN (SELECT id FROM public.profiles WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
);

-- Users can delete their own documents
CREATE POLICY "Users can delete their own prep documents"
ON public.sales_prep_documents
FOR DELETE
USING (
  profile_id IN (SELECT id FROM public.profiles WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
);

-- Public access for shared documents via share_token
CREATE POLICY "Anyone can view public prep documents"
ON public.sales_prep_documents
FOR SELECT
USING (is_public = true);

-- Create indexes
CREATE INDEX idx_sales_prep_documents_profile ON public.sales_prep_documents(profile_id);
CREATE INDEX idx_sales_prep_documents_company ON public.sales_prep_documents(company_id);
CREATE INDEX idx_sales_prep_documents_deal ON public.sales_prep_documents(deal_id);
CREATE INDEX idx_sales_prep_documents_share_token ON public.sales_prep_documents(share_token);

-- Add trigger for updated_at
CREATE TRIGGER update_sales_prep_documents_updated_at
BEFORE UPDATE ON public.sales_prep_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();