-- Create tables needed by Strategic Learning Design feature

-- 1) strategic_learning_reports
CREATE TABLE IF NOT EXISTS public.strategic_learning_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  timeframe_years INT NOT NULL DEFAULT 3,
  total_employees INT,
  total_cohorts INT,
  executive_summary JSONB,
  budget_scenarios JSONB,
  roi_projections JSONB,
  generated_by UUID,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '90 days')
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_slr_company ON public.strategic_learning_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_slr_generated_at ON public.strategic_learning_reports(generated_at DESC);

-- 2) training_cohorts
CREATE TABLE IF NOT EXISTS public.training_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.strategic_learning_reports(id) ON DELETE CASCADE,
  cohort_name TEXT NOT NULL,
  capability_name TEXT,
  employee_ids UUID[] NOT NULL,
  employee_count INT NOT NULL,
  priority INT,
  recommended_solutions JSONB,
  estimated_cost_per_employee NUMERIC(12,2),
  total_estimated_cost NUMERIC(12,2),
  expected_roi_percentage INT,
  timeline_weeks INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_cohorts_report ON public.training_cohorts(report_id);

-- 3) strategic_learning_notifications
CREATE TABLE IF NOT EXISTS public.strategic_learning_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  report_id UUID REFERENCES public.strategic_learning_reports(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  message TEXT,
  sent_to UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sln_company ON public.strategic_learning_notifications(company_id);

-- Enable Row Level Security
ALTER TABLE public.strategic_learning_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategic_learning_notifications ENABLE ROW LEVEL SECURITY;

-- Policies for strategic_learning_reports: company admins/users can read their company reports
DROP POLICY IF EXISTS "View reports by company" ON public.strategic_learning_reports;
CREATE POLICY "View reports by company"
ON public.strategic_learning_reports
FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

-- Policies for training_cohorts: visible if the linked report belongs to caller's company
DROP POLICY IF EXISTS "View cohorts via report company" ON public.training_cohorts;
CREATE POLICY "View cohorts via report company"
ON public.training_cohorts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.strategic_learning_reports r
    WHERE r.id = report_id
      AND r.company_id = public.get_user_company_id(auth.uid())
  )
);

-- Policies for strategic_learning_notifications: same company and addressed to user (or broadcast when sent_to is NULL)
DROP POLICY IF EXISTS "View notifications for user and company" ON public.strategic_learning_notifications;
CREATE POLICY "View notifications for user and company"
ON public.strategic_learning_notifications
FOR SELECT
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (
    sent_to IS NULL
    OR auth.uid() = ANY(sent_to)
  )
);
