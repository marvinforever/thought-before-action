-- Fix search_path for all functions that don't have it set

-- Fix update_user_data_completeness
CREATE OR REPLACE FUNCTION public.update_user_data_completeness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.user_data_completeness (profile_id)
  VALUES (NEW.id)
  ON CONFLICT (profile_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Fix check_capability_promotion
CREATE OR REPLACE FUNCTION public.check_capability_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  usage_count integer;
BEGIN
  -- Count distinct companies using this capability
  SELECT COUNT(DISTINCT company_id) INTO usage_count
  FROM public.capability_usage_stats
  WHERE capability_id = NEW.capability_id;
  
  -- Update companies_using_count on capabilities table
  UPDATE public.capabilities
  SET companies_using_count = usage_count
  WHERE id = NEW.capability_id;
  
  RETURN NEW;
END;
$function$;

-- Fix update_last_updated_column
CREATE OR REPLACE FUNCTION public.update_last_updated_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.last_updated = now();
  RETURN NEW;
END;
$function$;

-- Fix log_company_change
CREATE OR REPLACE FUNCTION public.log_company_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Only log if company_id actually changed
  IF (TG_OP = 'UPDATE' AND OLD.company_id IS DISTINCT FROM NEW.company_id) THEN
    INSERT INTO public.profile_company_changes (
      profile_id,
      old_company_id,
      new_company_id,
      changed_by,
      change_source
    ) VALUES (
      NEW.id,
      OLD.company_id,
      NEW.company_id,
      auth.uid(),
      'profile_update'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix refresh_user_completeness
CREATE OR REPLACE FUNCTION public.refresh_user_completeness(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- Fix update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix admin_create_profile
CREATE OR REPLACE FUNCTION public.admin_create_profile(p_admin_id uuid, p_email text, p_full_name text DEFAULT NULL::text, p_is_admin boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_company_id uuid;
  v_new_id uuid := gen_random_uuid();
BEGIN
  -- Ensure caller is a company admin
  SELECT company_id INTO v_company_id
  FROM public.profiles
  WHERE id = p_admin_id AND is_admin = true;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized to create profiles';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, company_id, is_admin)
  VALUES (v_new_id, lower(trim(p_email)), p_full_name, v_company_id, COALESCE(p_is_admin, false));

  RETURN v_new_id;
END;
$function$;