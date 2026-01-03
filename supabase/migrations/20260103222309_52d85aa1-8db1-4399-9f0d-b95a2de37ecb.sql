-- Add capability and goal linking to recognition_notes
ALTER TABLE public.recognition_notes 
ADD COLUMN IF NOT EXISTS capability_id uuid REFERENCES public.capabilities(id),
ADD COLUMN IF NOT EXISTS goal_id uuid REFERENCES public.personal_goals(id),
ADD COLUMN IF NOT EXISTS template_id uuid,
ADD COLUMN IF NOT EXISTS is_quick_kudos boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS impact_level text CHECK (impact_level IN ('small_win', 'significant', 'exceptional'));

-- Create recognition templates table
CREATE TABLE public.recognition_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id),
  title text NOT NULL,
  description_prompt text,
  category text,
  is_system_template boolean DEFAULT false,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on templates
ALTER TABLE public.recognition_templates ENABLE ROW LEVEL SECURITY;

-- Company users can view their templates + system templates
CREATE POLICY "Users can view company and system templates"
ON public.recognition_templates
FOR SELECT
USING (
  is_system_template = true 
  OR company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

-- Create recognition analytics tracking
CREATE TABLE public.recognition_analytics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  giver_id uuid NOT NULL REFERENCES public.profiles(id),
  receiver_id uuid NOT NULL REFERENCES public.profiles(id),
  recognition_id uuid NOT NULL REFERENCES public.recognition_notes(id) ON DELETE CASCADE,
  capability_id uuid REFERENCES public.capabilities(id),
  category text,
  impact_level text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.recognition_analytics ENABLE ROW LEVEL SECURITY;

-- Managers can view analytics for their company
CREATE POLICY "Company users can view recognition analytics"
ON public.recognition_analytics
FOR SELECT
USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Insert system templates
INSERT INTO public.recognition_templates (title, description_prompt, category, is_system_template, display_order) VALUES
('Helped a Teammate', 'Describe how they helped and the impact it had...', 'Teamwork', true, 1),
('Exceeded Expectations', 'What did they deliver beyond what was expected?', 'Going Above & Beyond', true, 2),
('Great Client Interaction', 'Describe the client situation and how they handled it...', 'Customer Focus', true, 3),
('Solved a Tough Problem', 'What was the problem and how did they solve it?', 'Problem Solving', true, 4),
('Showed Leadership', 'How did they demonstrate leadership?', 'Leadership', true, 5),
('Creative Solution', 'What innovative approach did they take?', 'Innovation', true, 6),
('Clear Communication', 'How did their communication make a difference?', 'Communication', true, 7),
('Handled Pressure Well', 'Describe the high-pressure situation and their response...', 'Going Above & Beyond', true, 8);

-- Update RLS on recognition_notes to allow peer recognition (same company)
DROP POLICY IF EXISTS "Users can insert recognition for same company" ON public.recognition_notes;

CREATE POLICY "Users can insert recognition for same company"
ON public.recognition_notes
FOR INSERT
WITH CHECK (
  company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  AND given_by = auth.uid()
);

-- Allow users to view recognition they gave, received, or company-wide
DROP POLICY IF EXISTS "Users can view relevant recognition" ON public.recognition_notes;

CREATE POLICY "Users can view relevant recognition"
ON public.recognition_notes
FOR SELECT
USING (
  given_by = auth.uid()
  OR given_to = auth.uid()
  OR (visibility = 'company' AND company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
  OR (visibility = 'team' AND company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_recognition_notes_given_to ON public.recognition_notes(given_to);
CREATE INDEX IF NOT EXISTS idx_recognition_notes_given_by ON public.recognition_notes(given_by);
CREATE INDEX IF NOT EXISTS idx_recognition_notes_company_date ON public.recognition_notes(company_id, recognition_date DESC);
CREATE INDEX IF NOT EXISTS idx_recognition_analytics_receiver ON public.recognition_analytics(receiver_id);
CREATE INDEX IF NOT EXISTS idx_recognition_analytics_giver ON public.recognition_analytics(giver_id);