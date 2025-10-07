-- Phase 2: Proactive Risk Detection System
-- Create employee_risk_flags table
CREATE TABLE IF NOT EXISTS public.employee_risk_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  risk_type TEXT NOT NULL CHECK (risk_type IN ('burnout', 'flight_risk', 'disengaged', 'unclear_path')),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('critical', 'moderate', 'low')),
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  auto_generated BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on employee_risk_flags
ALTER TABLE public.employee_risk_flags ENABLE ROW LEVEL SECURITY;

-- Admins can view all risk flags in their company
CREATE POLICY "Admins can view risk flags in their company"
ON public.employee_risk_flags
FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Managers can view risk flags for their direct reports
CREATE POLICY "Managers can view risk flags for their reports"
ON public.employee_risk_flags
FOR SELECT
USING (
  profile_id IN (
    SELECT employee_id FROM public.manager_assignments
    WHERE manager_id = auth.uid()
  )
);

-- System can insert risk flags
CREATE POLICY "System can insert risk flags"
ON public.employee_risk_flags
FOR INSERT
WITH CHECK (true);

-- Admins and managers can update risk flags
CREATE POLICY "Admins can update risk flags in their company"
ON public.employee_risk_flags
FOR UPDATE
USING (
  company_id IN (
    SELECT company_id FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Create index for performance
CREATE INDEX idx_employee_risk_flags_profile ON public.employee_risk_flags(profile_id);
CREATE INDEX idx_employee_risk_flags_company ON public.employee_risk_flags(company_id);
CREATE INDEX idx_employee_risk_flags_unresolved ON public.employee_risk_flags(profile_id, resolved_at) WHERE resolved_at IS NULL;

-- Phase 6: Training ROI Measurement
-- Create training_roi_tracking table
CREATE TABLE IF NOT EXISTS public.training_roi_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('retention_rate', 'time_to_promotion', 'training_spend', 'engagement_trend', 'burnout_incidents')),
  baseline_value NUMERIC,
  current_value NUMERIC,
  measured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on training_roi_tracking
ALTER TABLE public.training_roi_tracking ENABLE ROW LEVEL SECURITY;

-- Admins can view ROI tracking in their company
CREATE POLICY "Admins can view ROI tracking in their company"
ON public.training_roi_tracking
FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- System can insert ROI tracking records
CREATE POLICY "System can insert ROI tracking"
ON public.training_roi_tracking
FOR INSERT
WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_training_roi_company ON public.training_roi_tracking(company_id);
CREATE INDEX idx_training_roi_period ON public.training_roi_tracking(period_start, period_end);

-- Phase 3: Resource Recommendation Improvements
-- Add content_type to resources table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'resources' 
    AND column_name = 'content_type'
  ) THEN
    ALTER TABLE public.resources 
    ADD COLUMN content_type TEXT DEFAULT 'article' CHECK (content_type IN ('article', 'video', 'podcast', 'course', 'book', 'mentorship', 'linkedin_learning'));
  END IF;
END $$;