-- Create AI efficiency reports table for company-wide analysis
CREATE TABLE public.ai_efficiency_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  executive_summary JSONB NOT NULL DEFAULT '{}',
  role_analysis JSONB NOT NULL DEFAULT '[]',
  department_analysis JSONB NOT NULL DEFAULT '[]',
  total_estimated_hours_saved DECIMAL(10,2) DEFAULT 0,
  total_employees_analyzed INTEGER DEFAULT 0,
  efficiency_score DECIMAL(5,2) DEFAULT 0,
  quick_wins JSONB NOT NULL DEFAULT '[]',
  implementation_roadmap JSONB NOT NULL DEFAULT '[]',
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create employee AI recommendations table for individual suggestions
CREATE TABLE public.employee_ai_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_description_id UUID REFERENCES public.job_descriptions(id) ON DELETE SET NULL,
  recommendations JSONB NOT NULL DEFAULT '[]',
  priority_tasks JSONB NOT NULL DEFAULT '[]',
  recommended_tools JSONB NOT NULL DEFAULT '[]',
  estimated_weekly_hours_saved DECIMAL(10,2) DEFAULT 0,
  ai_readiness_score DECIMAL(5,2) DEFAULT 0,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  mentioned_in_podcast BOOLEAN DEFAULT false,
  last_podcast_mention DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_efficiency_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_ai_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_efficiency_reports (admins only)
CREATE POLICY "Admins can view company AI efficiency reports"
  ON public.ai_efficiency_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id
      WHERE p.id = auth.uid()
      AND p.company_id = ai_efficiency_reports.company_id
      AND ur.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can insert AI efficiency reports"
  ON public.ai_efficiency_reports
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id
      WHERE p.id = auth.uid()
      AND p.company_id = ai_efficiency_reports.company_id
      AND ur.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update AI efficiency reports"
  ON public.ai_efficiency_reports
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id
      WHERE p.id = auth.uid()
      AND p.company_id = ai_efficiency_reports.company_id
      AND ur.role IN ('admin', 'super_admin')
    )
  );

-- RLS policies for employee_ai_recommendations
CREATE POLICY "Users can view their own AI recommendations"
  ON public.employee_ai_recommendations
  FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Admins can view all company AI recommendations"
  ON public.employee_ai_recommendations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id
      JOIN public.profiles emp ON emp.id = employee_ai_recommendations.profile_id
      WHERE p.id = auth.uid()
      AND p.company_id = emp.company_id
      AND ur.role IN ('admin', 'super_admin', 'manager')
    )
  );

CREATE POLICY "System can insert AI recommendations"
  ON public.employee_ai_recommendations
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update AI recommendations"
  ON public.employee_ai_recommendations
  FOR UPDATE
  USING (true);

-- Create indexes for performance
CREATE INDEX idx_ai_efficiency_reports_company ON public.ai_efficiency_reports(company_id);
CREATE INDEX idx_ai_efficiency_reports_generated ON public.ai_efficiency_reports(generated_at DESC);
CREATE INDEX idx_employee_ai_recommendations_profile ON public.employee_ai_recommendations(profile_id);
CREATE INDEX idx_employee_ai_recommendations_podcast ON public.employee_ai_recommendations(profile_id, mentioned_in_podcast) WHERE mentioned_in_podcast = false;

-- Create updated_at trigger for employee_ai_recommendations
CREATE TRIGGER update_employee_ai_recommendations_updated_at
  BEFORE UPDATE ON public.employee_ai_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();