-- Add three_year_vision to personal_goals table
ALTER TABLE public.personal_goals
ADD COLUMN IF NOT EXISTS three_year_vision text;

-- Create greatness_keys table to track earned keys
CREATE TABLE IF NOT EXISTS public.greatness_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  earned_at timestamp with time zone NOT NULL DEFAULT now(),
  streak_length integer NOT NULL,
  habit_id uuid REFERENCES public.leading_indicators(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on greatness_keys
ALTER TABLE public.greatness_keys ENABLE ROW LEVEL SECURITY;

-- RLS policies for greatness_keys
CREATE POLICY "Users can view their own greatness keys"
  ON public.greatness_keys
  FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Users can insert their own greatness keys"
  ON public.greatness_keys
  FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Admins can view all greatness keys in their company"
  ON public.greatness_keys
  FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  ));

-- Add 30-day benchmarks and 7-day sprints fields to ninety_day_targets
ALTER TABLE public.ninety_day_targets
ADD COLUMN IF NOT EXISTS benchmarks jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS sprints jsonb DEFAULT '[]'::jsonb;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_greatness_keys_profile_id ON public.greatness_keys(profile_id);
CREATE INDEX IF NOT EXISTS idx_greatness_keys_habit_id ON public.greatness_keys(habit_id);