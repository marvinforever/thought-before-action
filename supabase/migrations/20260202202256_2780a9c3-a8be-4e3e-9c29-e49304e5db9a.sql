-- Fix the refresh_user_completeness function - remove reference to non-existent goal_type column
CREATE OR REPLACE FUNCTION public.refresh_user_completeness(user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
  v_has_vision boolean := false;
  v_has_goals boolean := false;
  v_has_habits boolean := false;
  v_has_capabilities boolean := false;
  v_has_jericho boolean := false;
  v_has_resource boolean := false;
  v_has_achievements boolean := false;
  v_has_diagnostic boolean := false;
  v_score integer := 0;
  v_phase text := 'new';
BEGIN
  -- Get user's company
  SELECT company_id INTO v_company_id FROM profiles WHERE id = user_id;
  
  -- Check for personal vision (professional OR personal - table doesn't have goal_type column)
  SELECT EXISTS(
    SELECT 1 FROM personal_goals 
    WHERE profile_id = user_id 
    AND (one_year_vision IS NOT NULL OR three_year_vision IS NOT NULL
         OR personal_one_year_vision IS NOT NULL OR personal_three_year_vision IS NOT NULL)
  ) INTO v_has_vision;
  
  -- Check for 90-day goals
  SELECT EXISTS(
    SELECT 1 FROM ninety_day_targets 
    WHERE profile_id = user_id 
    AND goal_text IS NOT NULL
  ) INTO v_has_goals;
  
  -- Check for active habits
  SELECT EXISTS(
    SELECT 1 FROM leading_indicators 
    WHERE profile_id = user_id 
    AND is_active = true
  ) INTO v_has_habits;
  
  -- Check for self-assessed capabilities
  SELECT EXISTS(
    SELECT 1 FROM employee_capabilities 
    WHERE profile_id = user_id 
    AND self_assessed_at IS NOT NULL
  ) INTO v_has_capabilities;
  
  -- Check for Jericho conversations
  SELECT EXISTS(
    SELECT 1 FROM conversations 
    WHERE profile_id = user_id
  ) INTO v_has_jericho;
  
  -- Check for received resources
  SELECT EXISTS(
    SELECT 1 FROM content_recommendations 
    WHERE profile_id = user_id
  ) INTO v_has_resource;
  
  -- Check for achievements
  SELECT EXISTS(
    SELECT 1 FROM achievements 
    WHERE profile_id = user_id
  ) INTO v_has_achievements;
  
  -- Check for completed diagnostic (has scores in diagnostic_scores table)
  SELECT EXISTS(
    SELECT 1 FROM diagnostic_scores 
    WHERE profile_id = user_id
  ) INTO v_has_diagnostic;
  
  -- Calculate score (8 items, each with different weights)
  v_score := 0;
  IF v_has_jericho THEN v_score := v_score + 10; END IF;
  IF v_has_vision THEN v_score := v_score + 12; END IF;
  IF v_has_habits THEN v_score := v_score + 12; END IF;
  IF v_has_goals THEN v_score := v_score + 15; END IF;
  IF v_has_achievements THEN v_score := v_score + 10; END IF;
  IF v_has_capabilities THEN v_score := v_score + 15; END IF;
  IF v_has_resource THEN v_score := v_score + 10; END IF;
  IF v_has_diagnostic THEN v_score := v_score + 16; END IF;
  
  -- Determine phase
  IF v_score >= 100 THEN
    v_phase := 'complete';
  ELSIF v_score > 0 THEN
    v_phase := 'in_progress';
  ELSE
    v_phase := 'new';
  END IF;
  
  -- Upsert the completeness record
  INSERT INTO user_data_completeness (
    profile_id,
    has_personal_vision,
    has_90_day_goals,
    has_active_habits,
    has_self_assessed_capabilities,
    has_chatted_with_jericho,
    has_received_resource,
    has_recent_achievements,
    has_completed_diagnostic,
    onboarding_score,
    onboarding_phase,
    updated_at
  ) VALUES (
    user_id,
    v_has_vision,
    v_has_goals,
    v_has_habits,
    v_has_capabilities,
    v_has_jericho,
    v_has_resource,
    v_has_achievements,
    v_has_diagnostic,
    v_score,
    v_phase,
    now()
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    has_personal_vision = v_has_vision,
    has_90_day_goals = v_has_goals,
    has_active_habits = v_has_habits,
    has_self_assessed_capabilities = v_has_capabilities,
    has_chatted_with_jericho = v_has_jericho,
    has_received_resource = v_has_resource,
    has_recent_achievements = v_has_achievements,
    has_completed_diagnostic = v_has_diagnostic,
    onboarding_score = v_score,
    onboarding_phase = v_phase,
    updated_at = now();
END;
$function$