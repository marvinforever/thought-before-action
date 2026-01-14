-- Add logo_url to profiles for permanent storage
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_logo_url TEXT;

-- Create storage bucket for company logos if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their company logo
CREATE POLICY "Users can upload company logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to update their company logo
CREATE POLICY "Users can update company logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read access to company logos
CREATE POLICY "Company logos are publicly readable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-logos');

-- Add grower history/notes field to sales_companies for CRM notes
ALTER TABLE public.sales_companies ADD COLUMN IF NOT EXISTS grower_history TEXT;
ALTER TABLE public.sales_companies ADD COLUMN IF NOT EXISTS operation_details JSONB;
ALTER TABLE public.sales_companies ADD COLUMN IF NOT EXISTS customer_since INTEGER;
ALTER TABLE public.sales_companies ADD COLUMN IF NOT EXISTS location TEXT;