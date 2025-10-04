-- Create one_on_one_notes table for manager-employee conversations
CREATE TABLE public.one_on_one_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  meeting_date DATE NOT NULL,
  notes TEXT,
  wins TEXT,
  concerns TEXT,
  action_items JSONB DEFAULT '[]'::jsonb,
  next_meeting_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.one_on_one_notes ENABLE ROW LEVEL SECURITY;

-- RLS policies for one_on_one_notes
CREATE POLICY "Managers can manage their own 1-on-1 notes"
ON public.one_on_one_notes
FOR ALL
USING (manager_id = auth.uid());

CREATE POLICY "Employees can view their 1-on-1 notes"
ON public.one_on_one_notes
FOR SELECT
USING (employee_id = auth.uid());

CREATE POLICY "Admins can view all 1-on-1 notes in their company"
ON public.one_on_one_notes
FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM profiles 
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Create trigger for updating updated_at
CREATE TRIGGER update_one_on_one_notes_updated_at
BEFORE UPDATE ON public.one_on_one_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create recognition_notes table for capturing good work
CREATE TABLE public.recognition_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  given_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  given_to UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  recognition_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'company')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recognition_notes ENABLE ROW LEVEL SECURITY;

-- RLS policies for recognition_notes
CREATE POLICY "Users can create recognition"
ON public.recognition_notes
FOR INSERT
WITH CHECK (given_by = auth.uid());

CREATE POLICY "Users can view recognition given to them"
ON public.recognition_notes
FOR SELECT
USING (given_to = auth.uid() OR given_by = auth.uid());

CREATE POLICY "Managers can view recognition for their reports"
ON public.recognition_notes
FOR SELECT
USING (
  given_to IN (
    SELECT employee_id FROM manager_assignments 
    WHERE manager_id = auth.uid()
  )
);

CREATE POLICY "Team visibility recognition is viewable by company"
ON public.recognition_notes
FOR SELECT
USING (
  visibility IN ('team', 'company') 
  AND company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

-- Update performance_reviews table with more fields
ALTER TABLE public.performance_reviews 
ADD COLUMN IF NOT EXISTS overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
ADD COLUMN IF NOT EXISTS strengths TEXT,
ADD COLUMN IF NOT EXISTS areas_for_improvement TEXT,
ADD COLUMN IF NOT EXISTS goals_met JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS goals_missed JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS ai_draft TEXT,
ADD COLUMN IF NOT EXISTS manager_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS employee_acknowledged_at TIMESTAMPTZ;

-- Create feedback_requests table for proactive manager prompts
CREATE TABLE public.feedback_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('one_on_one_overdue', 'goal_check_overdue', 'recognition_prompt', 'review_prep')),
  message TEXT NOT NULL,
  dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.feedback_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for feedback_requests
CREATE POLICY "Managers can view and manage their feedback requests"
ON public.feedback_requests
FOR ALL
USING (manager_id = auth.uid());