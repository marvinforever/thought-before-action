-- Create table for roadmap interest indicators
CREATE TABLE public.roadmap_interest_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('priority_focus', 'future_investment', 'quick_win')),
  item_title TEXT NOT NULL,
  item_details JSONB,
  indicated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  manager_viewed BOOLEAN NOT NULL DEFAULT false,
  admin_viewed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.roadmap_interest_indicators ENABLE ROW LEVEL SECURITY;

-- Users can insert their own interest indicators
CREATE POLICY "Users can insert their own interest indicators"
ON public.roadmap_interest_indicators
FOR INSERT
WITH CHECK (profile_id = auth.uid());

-- Users can view their own interest indicators
CREATE POLICY "Users can view their own interest indicators"
ON public.roadmap_interest_indicators
FOR SELECT
USING (profile_id = auth.uid());

-- Admins can view all indicators in their company
CREATE POLICY "Admins can view all indicators in their company"
ON public.roadmap_interest_indicators
FOR SELECT
USING (
  company_id IN (
    SELECT company_id
    FROM profiles
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Admins can update indicators in their company (for marking as viewed)
CREATE POLICY "Admins can update indicators in their company"
ON public.roadmap_interest_indicators
FOR UPDATE
USING (
  company_id IN (
    SELECT company_id
    FROM profiles
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Managers can view indicators for their team members
CREATE POLICY "Managers can view indicators for their reports"
ON public.roadmap_interest_indicators
FOR SELECT
USING (
  profile_id IN (
    SELECT employee_id
    FROM manager_assignments
    WHERE manager_id = auth.uid()
  )
);

-- Managers can update indicators for their team members (for marking as viewed)
CREATE POLICY "Managers can update indicators for their reports"
ON public.roadmap_interest_indicators
FOR UPDATE
USING (
  profile_id IN (
    SELECT employee_id
    FROM manager_assignments
    WHERE manager_id = auth.uid()
  )
);

-- Create index for better query performance
CREATE INDEX idx_roadmap_interest_profile ON public.roadmap_interest_indicators(profile_id);
CREATE INDEX idx_roadmap_interest_company ON public.roadmap_interest_indicators(company_id);
CREATE INDEX idx_roadmap_interest_viewed ON public.roadmap_interest_indicators(manager_viewed, admin_viewed) WHERE NOT manager_viewed OR NOT admin_viewed;