-- Create personal goals table for vision statements
CREATE TABLE public.personal_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  one_year_vision text,
  three_year_vision text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create 90-day targets table
CREATE TABLE public.ninety_day_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  quarter text NOT NULL, -- Q1, Q2, Q3, Q4
  year integer NOT NULL,
  category text NOT NULL, -- 'personal' or 'professional'
  goal_number integer NOT NULL, -- 1, 2, or 3
  goal_text text,
  by_when date,
  support_needed text,
  completed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(profile_id, quarter, year, category, goal_number)
);

-- Create achievements table
CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL, -- 'personal' or 'professional'
  achievement_text text NOT NULL,
  achieved_date date,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.personal_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ninety_day_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for personal_goals
CREATE POLICY "Users can view their own goals"
  ON public.personal_goals FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Users can insert their own goals"
  ON public.personal_goals FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update their own goals"
  ON public.personal_goals FOR UPDATE
  USING (profile_id = auth.uid());

CREATE POLICY "Admins can view goals in their company"
  ON public.personal_goals FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = true
  ));

-- RLS Policies for ninety_day_targets
CREATE POLICY "Users can view their own targets"
  ON public.ninety_day_targets FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Users can insert their own targets"
  ON public.ninety_day_targets FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update their own targets"
  ON public.ninety_day_targets FOR UPDATE
  USING (profile_id = auth.uid());

CREATE POLICY "Users can delete their own targets"
  ON public.ninety_day_targets FOR DELETE
  USING (profile_id = auth.uid());

CREATE POLICY "Admins can view targets in their company"
  ON public.ninety_day_targets FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = true
  ));

-- RLS Policies for achievements
CREATE POLICY "Users can view their own achievements"
  ON public.achievements FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Users can insert their own achievements"
  ON public.achievements FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update their own achievements"
  ON public.achievements FOR UPDATE
  USING (profile_id = auth.uid());

CREATE POLICY "Users can delete their own achievements"
  ON public.achievements FOR DELETE
  USING (profile_id = auth.uid());

CREATE POLICY "Admins can view achievements in their company"
  ON public.achievements FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = true
  ));

-- Add triggers for updated_at
CREATE TRIGGER update_personal_goals_updated_at
  BEFORE UPDATE ON public.personal_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ninety_day_targets_updated_at
  BEFORE UPDATE ON public.ninety_day_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_achievements_updated_at
  BEFORE UPDATE ON public.achievements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();