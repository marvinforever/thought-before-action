-- Add additional lead capture fields to ai_readiness_assessments
ALTER TABLE public.ai_readiness_assessments 
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS job_title text;

-- Create storage bucket for job description uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-descriptions', 'job-descriptions', false)
ON CONFLICT (id) DO NOTHING;

-- Allow public uploads to job-descriptions bucket (for lead gen)
CREATE POLICY "Anyone can upload job descriptions"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'job-descriptions');

-- Allow reading own uploaded files via path
CREATE POLICY "Anyone can read job descriptions they reference"
ON storage.objects FOR SELECT
USING (bucket_id = 'job-descriptions');