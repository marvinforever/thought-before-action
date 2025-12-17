
-- Create user_scores table for tracking total points
CREATE TABLE public.user_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  weekly_points INTEGER NOT NULL DEFAULT 0,
  monthly_points INTEGER NOT NULL DEFAULT 0,
  streak_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  last_activity_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(profile_id)
);

-- Create point_transactions table for activity log
CREATE TABLE public.point_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  base_points INTEGER NOT NULL,
  multiplier_applied NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  final_points INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create point_config table for configurable point values
CREATE TABLE public.point_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_type TEXT NOT NULL UNIQUE,
  base_points INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default point configurations
INSERT INTO public.point_config (activity_type, base_points, description) VALUES
  ('daily_login', 5, 'Daily login to Jericho'),
  ('chat_conversation', 10, 'Chat conversation with Jericho'),
  ('diagnostic_first', 100, 'Complete first diagnostic assessment'),
  ('diagnostic_repeat', 50, 'Complete repeat diagnostic assessment'),
  ('goal_created', 25, 'Create a 90-day goal'),
  ('goal_completed', 50, 'Complete a 90-day goal'),
  ('habit_created', 10, 'Create a new habit'),
  ('habit_completed', 5, 'Complete daily habit'),
  ('greatness_key', 25, 'Earn a greatness key'),
  ('achievement_logged', 15, 'Log an achievement'),
  ('capability_assessed', 20, 'Self-assess a capability'),
  ('resource_viewed', 5, 'View a learning resource'),
  ('resource_completed', 15, 'Complete a learning resource'),
  ('badge_earned', 50, 'Earn a badge'),
  ('vision_set', 30, 'Set professional vision');

-- Enable RLS
ALTER TABLE public.user_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_config ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_scores
CREATE POLICY "Users can view their own scores"
  ON public.user_scores FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Users can view scores in their company for leaderboard"
  ON public.user_scores FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "System can insert scores"
  ON public.user_scores FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update scores"
  ON public.user_scores FOR UPDATE
  USING (true);

-- RLS policies for point_transactions
CREATE POLICY "Users can view their own transactions"
  ON public.point_transactions FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "System can insert transactions"
  ON public.point_transactions FOR INSERT
  WITH CHECK (true);

-- RLS policies for point_config
CREATE POLICY "Anyone can view point config"
  ON public.point_config FOR SELECT
  USING (true);

-- Create indexes for performance
CREATE INDEX idx_user_scores_company_total ON public.user_scores(company_id, total_points DESC);
CREATE INDEX idx_user_scores_company_weekly ON public.user_scores(company_id, weekly_points DESC);
CREATE INDEX idx_user_scores_company_monthly ON public.user_scores(company_id, monthly_points DESC);
CREATE INDEX idx_point_transactions_profile ON public.point_transactions(profile_id, created_at DESC);

-- Create the award_points function
CREATE OR REPLACE FUNCTION public.award_points(
  p_profile_id UUID,
  p_activity_type TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id UUID;
  v_base_points INTEGER;
  v_streak_multiplier NUMERIC(3,2) := 1.00;
  v_current_streak INTEGER;
  v_final_points INTEGER;
  v_last_activity DATE;
  v_today DATE := CURRENT_DATE;
  v_first_of_day_bonus NUMERIC(3,2) := 1.00;
BEGIN
  -- Get user's company
  SELECT company_id INTO v_company_id FROM profiles WHERE id = p_profile_id;
  
  IF v_company_id IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Get base points for activity
  SELECT base_points INTO v_base_points FROM point_config WHERE activity_type = p_activity_type;
  
  IF v_base_points IS NULL THEN
    v_base_points := 5; -- Default fallback
  END IF;
  
  -- Get current login streak for multiplier
  SELECT current_streak INTO v_current_streak FROM login_streaks WHERE profile_id = p_profile_id;
  
  IF v_current_streak IS NOT NULL THEN
    -- Streak multiplier: 1.0 base + 0.1 per 7 days of streak, max 2.0
    v_streak_multiplier := LEAST(1.00 + (FLOOR(v_current_streak / 7) * 0.10), 2.00);
  END IF;
  
  -- Check for first-of-day bonus
  SELECT last_activity_date INTO v_last_activity FROM user_scores WHERE profile_id = p_profile_id;
  
  IF v_last_activity IS NULL OR v_last_activity < v_today THEN
    v_first_of_day_bonus := 1.25; -- 25% bonus for first activity of the day
  END IF;
  
  -- Calculate final points
  v_final_points := ROUND(v_base_points * v_streak_multiplier * v_first_of_day_bonus);
  
  -- Ensure user_scores record exists
  INSERT INTO user_scores (profile_id, company_id, total_points, weekly_points, monthly_points, streak_multiplier, last_activity_date)
  VALUES (p_profile_id, v_company_id, 0, 0, 0, v_streak_multiplier, v_today)
  ON CONFLICT (profile_id) DO NOTHING;
  
  -- Update user scores
  UPDATE user_scores
  SET 
    total_points = total_points + v_final_points,
    weekly_points = weekly_points + v_final_points,
    monthly_points = monthly_points + v_final_points,
    streak_multiplier = v_streak_multiplier,
    last_activity_date = v_today,
    updated_at = now()
  WHERE profile_id = p_profile_id;
  
  -- Log the transaction
  INSERT INTO point_transactions (profile_id, company_id, activity_type, base_points, multiplier_applied, final_points, description)
  VALUES (p_profile_id, v_company_id, p_activity_type, v_base_points, v_streak_multiplier * v_first_of_day_bonus, v_final_points, COALESCE(p_description, (SELECT description FROM point_config WHERE activity_type = p_activity_type)));
  
  RETURN v_final_points;
END;
$$;

-- Create trigger to update updated_at
CREATE TRIGGER update_user_scores_updated_at
  BEFORE UPDATE ON public.user_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Weekly/monthly reset function (to be called by cron)
CREATE OR REPLACE FUNCTION public.reset_periodic_points()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Reset weekly points on Mondays
  IF EXTRACT(DOW FROM CURRENT_DATE) = 1 THEN
    UPDATE user_scores SET weekly_points = 0;
  END IF;
  
  -- Reset monthly points on 1st of month
  IF EXTRACT(DAY FROM CURRENT_DATE) = 1 THEN
    UPDATE user_scores SET monthly_points = 0;
  END IF;
END;
$$;
