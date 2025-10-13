-- Create user_data_completeness table to track what information Jericho should collect
CREATE TABLE public.user_data_completeness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  has_personal_vision BOOLEAN DEFAULT false,
  has_90_day_goals BOOLEAN DEFAULT false,
  has_active_habits BOOLEAN DEFAULT false,
  has_completed_diagnostic BOOLEAN DEFAULT false,
  has_self_assessed_capabilities BOOLEAN DEFAULT false,
  has_recent_achievements BOOLEAN DEFAULT false,
  onboarding_phase TEXT DEFAULT 'new' CHECK (onboarding_phase IN ('new', 'in_progress', 'complete')),
  last_jericho_prompt TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(profile_id)
);

-- Enable RLS
ALTER TABLE public.user_data_completeness ENABLE ROW LEVEL SECURITY;

-- Users can view their own completeness data
CREATE POLICY "Users can view their own completeness data"
ON public.user_data_completeness
FOR SELECT
USING (profile_id = auth.uid());

-- Users can insert their own completeness data
CREATE POLICY "Users can insert their own completeness data"
ON public.user_data_completeness
FOR INSERT
WITH CHECK (profile_id = auth.uid());

-- Users can update their own completeness data
CREATE POLICY "Users can update their own completeness data"
ON public.user_data_completeness
FOR UPDATE
USING (profile_id = auth.uid());

-- Admins can view all completeness data in their company
CREATE POLICY "Admins can view all completeness data"
ON public.user_data_completeness
FOR SELECT
USING (
  profile_id IN (
    SELECT id FROM public.profiles 
    WHERE company_id IN (
      SELECT company_id FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  )
);

-- Create function to update completeness data automatically
CREATE OR REPLACE FUNCTION public.update_user_data_completeness()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_data_completeness (profile_id)
  VALUES (NEW.id)
  ON CONFLICT (profile_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger to create completeness record when profile is created
CREATE TRIGGER on_profile_created_create_completeness
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_user_data_completeness();

-- Create function to refresh completeness status
CREATE OR REPLACE FUNCTION public.refresh_user_completeness(user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vision_exists BOOLEAN;
  goals_count INTEGER;
  habits_count INTEGER;
  diagnostic_exists BOOLEAN;
  assessed_caps_count INTEGER;
  recent_achievements_count INTEGER;
  phase TEXT;
BEGIN
  -- Check personal vision
  SELECT EXISTS(
    SELECT 1 FROM public.personal_goals 
    WHERE profile_id = user_id AND (one_year_vision IS NOT NULL OR three_year_vision IS NOT NULL)
  ) INTO vision_exists;
  
  -- Count 90-day goals
  SELECT COUNT(*) INTO goals_count
  FROM public.ninety_day_targets
  WHERE profile_id = user_id AND completed = false;
  
  -- Count active habits
  SELECT COUNT(*) INTO habits_count
  FROM public.leading_indicators
  WHERE profile_id = user_id AND is_active = true;
  
  -- Check diagnostic completion
  SELECT EXISTS(
    SELECT 1 FROM public.diagnostic_responses 
    WHERE profile_id = user_id
  ) INTO diagnostic_exists;
  
  -- Count self-assessed capabilities
  SELECT COUNT(*) INTO assessed_caps_count
  FROM public.employee_capabilities
  WHERE profile_id = user_id AND self_assessed_level IS NOT NULL;
  
  -- Count recent achievements (last 30 days)
  SELECT COUNT(*) INTO recent_achievements_count
  FROM public.achievements
  WHERE profile_id = user_id 
  AND achieved_date >= CURRENT_DATE - INTERVAL '30 days';
  
  -- Determine onboarding phase
  IF goals_count >= 3 AND habits_count >= 1 AND vision_exists THEN
    phase := 'complete';
  ELSIF goals_count > 0 OR habits_count > 0 OR vision_exists THEN
    phase := 'in_progress';
  ELSE
    phase := 'new';
  END IF;
  
  -- Update or insert completeness record
  INSERT INTO public.user_data_completeness (
    profile_id,
    has_personal_vision,
    has_90_day_goals,
    has_active_habits,
    has_completed_diagnostic,
    has_self_assessed_capabilities,
    has_recent_achievements,
    onboarding_phase,
    updated_at
  ) VALUES (
    user_id,
    vision_exists,
    goals_count >= 3,
    habits_count >= 1,
    diagnostic_exists,
    assessed_caps_count >= 5,
    recent_achievements_count > 0,
    phase,
    now()
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    has_personal_vision = EXCLUDED.has_personal_vision,
    has_90_day_goals = EXCLUDED.has_90_day_goals,
    has_active_habits = EXCLUDED.has_active_habits,
    has_completed_diagnostic = EXCLUDED.has_completed_diagnostic,
    has_self_assessed_capabilities = EXCLUDED.has_self_assessed_capabilities,
    has_recent_achievements = EXCLUDED.has_recent_achievements,
    onboarding_phase = EXCLUDED.onboarding_phase,
    updated_at = now();
END;
$$;