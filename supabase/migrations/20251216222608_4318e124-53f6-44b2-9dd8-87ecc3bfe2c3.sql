-- Add new columns for onboarding tracking
ALTER TABLE public.user_data_completeness 
ADD COLUMN IF NOT EXISTS has_chatted_with_jericho boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS has_received_resource boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_score integer DEFAULT 0;

-- Update the refresh function to calculate onboarding score
CREATE OR REPLACE FUNCTION public.refresh_user_completeness(user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  vision_exists BOOLEAN;
  goals_count INTEGER;
  habits_count INTEGER;
  diagnostic_exists BOOLEAN;
  assessed_caps_count INTEGER;
  recent_achievements_count INTEGER;
  jericho_chat_exists BOOLEAN;
  resource_received BOOLEAN;
  phase TEXT;
  score INTEGER := 0;
BEGIN
  -- Check personal vision (professional)
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

  -- Check if user has chatted with Jericho
  SELECT EXISTS(
    SELECT 1 FROM public.conversations 
    WHERE profile_id = user_id
  ) INTO jericho_chat_exists;

  -- Check if user has received resource recommendations
  SELECT EXISTS(
    SELECT 1 FROM public.content_recommendations 
    WHERE profile_id = user_id
  ) INTO resource_received;
  
  -- Calculate onboarding score (100 points total)
  -- Vision: 15 points
  IF vision_exists THEN score := score + 15; END IF;
  -- 90-day goal: 20 points
  IF goals_count >= 1 THEN score := score + 20; END IF;
  -- Habit: 15 points
  IF habits_count >= 1 THEN score := score + 15; END IF;
  -- Self-assessment: 20 points
  IF assessed_caps_count >= 1 THEN score := score + 20; END IF;
  -- Jericho chat: 10 points
  IF jericho_chat_exists THEN score := score + 10; END IF;
  -- Resource recommendation: 10 points
  IF resource_received THEN score := score + 10; END IF;
  -- Achievement: 10 points
  IF recent_achievements_count > 0 THEN score := score + 10; END IF;

  -- Determine onboarding phase
  IF score >= 100 THEN
    phase := 'complete';
  ELSIF score > 0 THEN
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
    has_chatted_with_jericho,
    has_received_resource,
    onboarding_phase,
    onboarding_score,
    updated_at
  ) VALUES (
    user_id,
    vision_exists,
    goals_count >= 1,
    habits_count >= 1,
    diagnostic_exists,
    assessed_caps_count >= 1,
    recent_achievements_count > 0,
    jericho_chat_exists,
    resource_received,
    phase,
    score,
    now()
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    has_personal_vision = EXCLUDED.has_personal_vision,
    has_90_day_goals = EXCLUDED.has_90_day_goals,
    has_active_habits = EXCLUDED.has_active_habits,
    has_completed_diagnostic = EXCLUDED.has_completed_diagnostic,
    has_self_assessed_capabilities = EXCLUDED.has_self_assessed_capabilities,
    has_recent_achievements = EXCLUDED.has_recent_achievements,
    has_chatted_with_jericho = EXCLUDED.has_chatted_with_jericho,
    has_received_resource = EXCLUDED.has_received_resource,
    onboarding_phase = EXCLUDED.onboarding_phase,
    onboarding_score = EXCLUDED.onboarding_score,
    updated_at = now();
END;
$function$;