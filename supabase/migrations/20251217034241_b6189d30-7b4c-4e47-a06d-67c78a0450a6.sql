-- Create badges definition table
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  icon_emoji text NOT NULL DEFAULT '🏆',
  category text NOT NULL DEFAULT 'milestone',
  tier integer NOT NULL DEFAULT 1,
  requirement_type text NOT NULL, -- 'onboarding', 'goals_completed', 'streak', 'capability'
  requirement_value integer DEFAULT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create user badges earned table
CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}',
  UNIQUE(profile_id, badge_id)
);

-- Enable RLS
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Badges are readable by all authenticated users
CREATE POLICY "Anyone can view badges"
ON public.badges FOR SELECT
USING (true);

-- Users can view their own earned badges
CREATE POLICY "Users can view their own badges"
ON public.user_badges FOR SELECT
USING (profile_id = auth.uid());

-- Admins can view badges in their company
CREATE POLICY "Admins can view badges in their company"
ON public.user_badges FOR SELECT
USING (profile_id IN (
  SELECT id FROM profiles 
  WHERE company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid() AND is_admin = true
  )
));

-- System can insert badges (for automated awarding)
CREATE POLICY "System can insert user badges"
ON public.user_badges FOR INSERT
WITH CHECK (true);

-- Insert initial badges
INSERT INTO public.badges (slug, name, description, icon_emoji, category, tier, requirement_type, requirement_value, display_order) VALUES
-- Onboarding tier
('onboarding_complete', 'Growth Journey Started', 'Completed your initial setup and onboarding', '🚀', 'milestone', 1, 'onboarding', 100, 1),

-- Goal completion tiers
('goals_5', 'Goal Getter', 'Completed 5 goals', '🎯', 'goals', 1, 'goals_completed', 5, 10),
('goals_15', 'Goal Master', 'Completed 15 goals', '🏹', 'goals', 2, 'goals_completed', 15, 11),
('goals_30', 'Goal Champion', 'Completed 30 goals', '👑', 'goals', 3, 'goals_completed', 30, 12),
('goals_50', 'Goal Legend', 'Completed 50 goals', '🌟', 'goals', 4, 'goals_completed', 50, 13),

-- Streak tiers (login or habit streaks)
('streak_7', 'Week Warrior', '7-day login streak', '🔥', 'streak', 1, 'streak', 7, 20),
('streak_30', 'Monthly Maven', '30-day login streak', '💪', 'streak', 2, 'streak', 30, 21),
('streak_100', 'Century Club', '100-day login streak', '💎', 'streak', 3, 'streak', 100, 22),

-- Habit tiers
('habits_3', 'Habit Builder', 'Track 3 active habits', '🌱', 'habits', 1, 'habits_active', 3, 30),
('habits_earned_keys_5', 'Key Collector', 'Earned 5 Greatness Keys', '🔑', 'habits', 2, 'greatness_keys', 5, 31),
('habits_earned_keys_20', 'Key Master', 'Earned 20 Greatness Keys', '🗝️', 'habits', 3, 'greatness_keys', 20, 32);

-- Create function to check and award badges
CREATE OR REPLACE FUNCTION public.check_and_award_badges(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  badge_record RECORD;
  onboarding_score INTEGER;
  completed_goals INTEGER;
  login_streak INTEGER;
  active_habits INTEGER;
  greatness_keys_count INTEGER;
BEGIN
  -- Get user stats
  SELECT COALESCE(udc.onboarding_score, 0) INTO onboarding_score
  FROM user_data_completeness udc WHERE udc.profile_id = user_id;

  SELECT COUNT(*) INTO completed_goals
  FROM ninety_day_targets WHERE profile_id = user_id AND completed = true;

  SELECT COALESCE(ls.current_streak, 0) INTO login_streak
  FROM login_streaks ls WHERE ls.profile_id = user_id;

  SELECT COUNT(*) INTO active_habits
  FROM leading_indicators WHERE profile_id = user_id AND is_active = true;

  SELECT COUNT(*) INTO greatness_keys_count
  FROM greatness_keys WHERE profile_id = user_id;

  -- Loop through badges and award if earned
  FOR badge_record IN SELECT * FROM badges LOOP
    -- Skip if already earned
    IF EXISTS (SELECT 1 FROM user_badges WHERE profile_id = user_id AND badge_id = badge_record.id) THEN
      CONTINUE;
    END IF;

    -- Check requirements
    CASE badge_record.requirement_type
      WHEN 'onboarding' THEN
        IF onboarding_score >= badge_record.requirement_value THEN
          INSERT INTO user_badges (profile_id, badge_id) VALUES (user_id, badge_record.id);
        END IF;
      WHEN 'goals_completed' THEN
        IF completed_goals >= badge_record.requirement_value THEN
          INSERT INTO user_badges (profile_id, badge_id) VALUES (user_id, badge_record.id);
        END IF;
      WHEN 'streak' THEN
        IF login_streak >= badge_record.requirement_value THEN
          INSERT INTO user_badges (profile_id, badge_id) VALUES (user_id, badge_record.id);
        END IF;
      WHEN 'habits_active' THEN
        IF active_habits >= badge_record.requirement_value THEN
          INSERT INTO user_badges (profile_id, badge_id) VALUES (user_id, badge_record.id);
        END IF;
      WHEN 'greatness_keys' THEN
        IF greatness_keys_count >= badge_record.requirement_value THEN
          INSERT INTO user_badges (profile_id, badge_id) VALUES (user_id, badge_record.id);
        END IF;
      ELSE
        -- Unknown type, skip
    END CASE;
  END LOOP;
END;
$$;