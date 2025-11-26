-- Create diagnostic_scores table to store pre-calculated normalized scores
CREATE TABLE IF NOT EXISTS public.diagnostic_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  retention_score INTEGER CHECK (retention_score >= 0 AND retention_score <= 100),
  engagement_score INTEGER CHECK (engagement_score >= 0 AND engagement_score <= 100),
  burnout_score INTEGER CHECK (burnout_score >= 0 AND burnout_score <= 100),
  manager_score INTEGER CHECK (manager_score >= 0 AND manager_score <= 100),
  career_score INTEGER CHECK (career_score >= 0 AND career_score <= 100),
  clarity_score INTEGER CHECK (clarity_score >= 0 AND clarity_score <= 100),
  learning_score INTEGER CHECK (learning_score >= 0 AND learning_score <= 100),
  skills_score INTEGER CHECK (skills_score >= 0 AND skills_score <= 100),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id)
);

-- Enable RLS
ALTER TABLE public.diagnostic_scores ENABLE ROW LEVEL SECURITY;

-- Admins can view scores in their company
CREATE POLICY "Admins can view scores in their company"
  ON public.diagnostic_scores
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Managers can view scores for their reports
CREATE POLICY "Managers can view scores for their reports"
  ON public.diagnostic_scores
  FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT employee_id FROM public.manager_assignments
      WHERE manager_id = auth.uid()
    )
  );

-- Super admins can view all scores
CREATE POLICY "Super admins can view all scores"
  ON public.diagnostic_scores
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- Service role can insert and update scores
CREATE POLICY "Service role can manage scores"
  ON public.diagnostic_scores
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_diagnostic_scores_profile ON public.diagnostic_scores(profile_id);
CREATE INDEX idx_diagnostic_scores_company ON public.diagnostic_scores(company_id);