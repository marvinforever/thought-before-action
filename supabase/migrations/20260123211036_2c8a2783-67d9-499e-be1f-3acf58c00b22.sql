-- Create storage bucket for field maps
INSERT INTO storage.buckets (id, name, public)
VALUES ('field-maps', 'field-maps', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload field maps
CREATE POLICY "Users can upload field maps"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'field-maps');

-- Allow authenticated users to view field maps from their company
CREATE POLICY "Users can view field maps"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'field-maps');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete field maps"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'field-maps');

-- Create table to store field map analyses
CREATE TABLE public.field_map_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.sales_companies(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  map_type TEXT, -- 'yield_map', 'soil_map', 'satellite', 'planting_map', 'application_map', 'other'
  field_name TEXT,
  analysis_result JSONB, -- Structured analysis from AI
  sales_opportunities TEXT[], -- Extracted opportunity suggestions
  key_insights TEXT, -- Summary of findings
  raw_ai_response TEXT, -- Full AI response for reference
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.field_map_analyses ENABLE ROW LEVEL SECURITY;

-- RLS policies for field_map_analyses
CREATE POLICY "Users can view field maps for their company"
ON public.field_map_analyses FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert field maps for their company"
ON public.field_map_analyses FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update their own field map analyses"
ON public.field_map_analyses FOR UPDATE
TO authenticated
USING (profile_id = auth.uid());

CREATE POLICY "Users can delete their own field map analyses"
ON public.field_map_analyses FOR DELETE
TO authenticated
USING (profile_id = auth.uid());

-- Create index for faster lookups
CREATE INDEX idx_field_map_analyses_customer ON public.field_map_analyses(customer_id);
CREATE INDEX idx_field_map_analyses_company ON public.field_map_analyses(company_id);