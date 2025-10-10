-- Create strategic_learning_reports table
CREATE TABLE IF NOT EXISTS public.strategic_learning_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  executive_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  cohorts JSONB NOT NULL DEFAULT '[]'::jsonb,
  narrative TEXT,
  budget_scenarios JSONB NOT NULL DEFAULT '{}'::jsonb,
  roi_projections JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.strategic_learning_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view reports in their company
CREATE POLICY "Admins can view reports in their company"
ON public.strategic_learning_reports
FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id
    FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Policy: Super admins can view all reports
CREATE POLICY "Super admins can view all reports"
ON public.strategic_learning_reports
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = true
  )
);

-- Policy: Service role can insert reports (for edge functions)
CREATE POLICY "Service role can insert reports"
ON public.strategic_learning_reports
FOR INSERT
TO service_role
WITH CHECK (true);

-- Policy: Service role can update reports (for edge functions)
CREATE POLICY "Service role can update reports"
ON public.strategic_learning_reports
FOR UPDATE
TO service_role
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_strategic_learning_reports_updated_at
  BEFORE UPDATE ON public.strategic_learning_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_strategic_learning_reports_company_id 
  ON public.strategic_learning_reports(company_id);

CREATE INDEX IF NOT EXISTS idx_strategic_learning_reports_expires_at 
  ON public.strategic_learning_reports(expires_at);
