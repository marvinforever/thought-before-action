-- Table to store generated Leadership Acceleration Reports
CREATE TABLE public.leadership_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id),
  status text NOT NULL DEFAULT 'generating',
  report_content jsonb,
  capability_matrix jsonb,
  word_count integer,
  quality_checks jsonb,
  pdf_url text,
  share_token text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  delivered_at timestamptz,
  delivery_email text
);

ALTER TABLE public.leadership_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own reports" ON public.leadership_reports
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Public access via share token" ON public.leadership_reports
  FOR SELECT TO anon
  USING (share_token IS NOT NULL);

ALTER TABLE public.user_active_context ADD COLUMN IF NOT EXISTS report_url text;