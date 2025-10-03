-- Phase 0: Database Foundation for Greatness Tracker & Learning Lifecycle

-- 1. LEADING INDICATORS (Kaizen micro-habits)
CREATE TABLE public.leading_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  habit_name TEXT NOT NULL,
  habit_description TEXT,
  target_frequency TEXT NOT NULL DEFAULT 'daily', -- daily, weekly, etc.
  linked_capability_id UUID REFERENCES public.capabilities(id) ON DELETE SET NULL,
  linked_goal_id UUID REFERENCES public.ninety_day_targets(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT habit_name_not_empty CHECK (length(trim(habit_name)) > 0)
);

ALTER TABLE public.leading_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own habits"
  ON public.leading_indicators FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Users can insert their own habits"
  ON public.leading_indicators FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update their own habits"
  ON public.leading_indicators FOR UPDATE
  USING (profile_id = auth.uid());

CREATE POLICY "Users can delete their own habits"
  ON public.leading_indicators FOR DELETE
  USING (profile_id = auth.uid());

CREATE POLICY "Admins can view habits in their company"
  ON public.leading_indicators FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = true
  ));

CREATE INDEX idx_leading_indicators_profile ON public.leading_indicators(profile_id);
CREATE INDEX idx_leading_indicators_company ON public.leading_indicators(company_id);

-- 2. HABIT COMPLETIONS (Daily check-ins)
CREATE TABLE public.habit_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES public.leading_indicators(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  completed_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(habit_id, completed_date)
);

ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own completions"
  ON public.habit_completions FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Users can insert their own completions"
  ON public.habit_completions FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update their own completions"
  ON public.habit_completions FOR UPDATE
  USING (profile_id = auth.uid());

CREATE POLICY "Users can delete their own completions"
  ON public.habit_completions FOR DELETE
  USING (profile_id = auth.uid());

CREATE POLICY "Admins can view completions in their company"
  ON public.habit_completions FOR SELECT
  USING (profile_id IN (
    SELECT id FROM public.profiles 
    WHERE company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    )
  ));

CREATE INDEX idx_habit_completions_habit ON public.habit_completions(habit_id);
CREATE INDEX idx_habit_completions_profile ON public.habit_completions(profile_id);
CREATE INDEX idx_habit_completions_date ON public.habit_completions(completed_date);

-- 3. GROWTH JOURNAL (Reflections)
CREATE TABLE public.growth_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  entry_text TEXT NOT NULL,
  entry_source TEXT NOT NULL DEFAULT 'manual', -- manual, email_reply, etc.
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT entry_text_not_empty CHECK (length(trim(entry_text)) > 0)
);

ALTER TABLE public.growth_journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own journal"
  ON public.growth_journal FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Users can insert their own journal entries"
  ON public.growth_journal FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update their own journal entries"
  ON public.growth_journal FOR UPDATE
  USING (profile_id = auth.uid());

CREATE POLICY "Users can delete their own journal entries"
  ON public.growth_journal FOR DELETE
  USING (profile_id = auth.uid());

CREATE POLICY "Admins can view journal entries in their company"
  ON public.growth_journal FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = true
  ));

CREATE INDEX idx_growth_journal_profile ON public.growth_journal(profile_id);
CREATE INDEX idx_growth_journal_date ON public.growth_journal(entry_date);

-- 4. RESOURCE RATINGS (1-5 star ratings)
CREATE TABLE public.resource_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(resource_id, profile_id)
);

ALTER TABLE public.resource_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ratings"
  ON public.resource_ratings FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Users can insert their own ratings"
  ON public.resource_ratings FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update their own ratings"
  ON public.resource_ratings FOR UPDATE
  USING (profile_id = auth.uid());

CREATE POLICY "Users can delete their own ratings"
  ON public.resource_ratings FOR DELETE
  USING (profile_id = auth.uid());

CREATE POLICY "Admins can view ratings in their company"
  ON public.resource_ratings FOR SELECT
  USING (profile_id IN (
    SELECT id FROM public.profiles 
    WHERE company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    )
  ));

CREATE INDEX idx_resource_ratings_resource ON public.resource_ratings(resource_id);
CREATE INDEX idx_resource_ratings_profile ON public.resource_ratings(profile_id);

-- 5. CAPABILITY LEVEL REQUESTS (Employee-initiated level ups)
CREATE TABLE public.capability_level_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  capability_id UUID NOT NULL REFERENCES public.capabilities(id) ON DELETE CASCADE,
  current_level TEXT NOT NULL,
  requested_level TEXT NOT NULL,
  evidence_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  manager_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT evidence_not_empty CHECK (length(trim(evidence_text)) > 0)
);

ALTER TABLE public.capability_level_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own requests"
  ON public.capability_level_requests FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Users can insert their own requests"
  ON public.capability_level_requests FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Admins can view all requests in their company"
  ON public.capability_level_requests FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = true
  ));

CREATE POLICY "Admins can update requests in their company"
  ON public.capability_level_requests FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = true
  ));

CREATE INDEX idx_capability_level_requests_profile ON public.capability_level_requests(profile_id);
CREATE INDEX idx_capability_level_requests_status ON public.capability_level_requests(status);

-- 6. CAPABILITY LEVEL HISTORY (Audit trail)
CREATE TABLE public.capability_level_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  capability_id UUID NOT NULL REFERENCES public.capabilities(id) ON DELETE CASCADE,
  from_level TEXT,
  to_level TEXT NOT NULL,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  change_reason TEXT,
  request_id UUID REFERENCES public.capability_level_requests(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.capability_level_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own history"
  ON public.capability_level_history FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Admins can view history in their company"
  ON public.capability_level_history FOR SELECT
  USING (profile_id IN (
    SELECT id FROM public.profiles 
    WHERE company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    )
  ));

CREATE POLICY "System can insert history records"
  ON public.capability_level_history FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_capability_level_history_profile ON public.capability_level_history(profile_id);
CREATE INDEX idx_capability_level_history_capability ON public.capability_level_history(capability_id);

-- 7. PERFORMANCE REVIEWS (Manager-scheduled reviews)
CREATE TABLE public.performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  scheduled_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  review_date DATE NOT NULL,
  review_type TEXT NOT NULL DEFAULT 'quarterly', -- quarterly, annual, etc.
  ai_summary TEXT,
  manager_notes TEXT,
  employee_notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, completed, cancelled
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reviews"
  ON public.performance_reviews FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Users can update their own review notes"
  ON public.performance_reviews FOR UPDATE
  USING (profile_id = auth.uid());

CREATE POLICY "Admins can manage reviews in their company"
  ON public.performance_reviews FOR ALL
  USING (company_id IN (
    SELECT company_id FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = true
  ));

CREATE INDEX idx_performance_reviews_profile ON public.performance_reviews(profile_id);
CREATE INDEX idx_performance_reviews_date ON public.performance_reviews(review_date);
CREATE INDEX idx_performance_reviews_status ON public.performance_reviews(status);

-- 8. EMAIL PREFERENCES (User notification settings)
CREATE TABLE public.email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  frequency TEXT NOT NULL DEFAULT 'daily', -- daily, weekly, never
  preferred_day TEXT, -- monday, tuesday, etc. (for weekly)
  preferred_time TIME NOT NULL DEFAULT '08:00:00',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(profile_id)
);

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own preferences"
  ON public.email_preferences FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Users can insert their own preferences"
  ON public.email_preferences FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update their own preferences"
  ON public.email_preferences FOR UPDATE
  USING (profile_id = auth.uid());

CREATE INDEX idx_email_preferences_profile ON public.email_preferences(profile_id);

-- 9. LOGIN STREAKS (Gamification tracking)
CREATE TABLE public.login_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_login_date DATE NOT NULL,
  total_logins INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(profile_id)
);

ALTER TABLE public.login_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own streaks"
  ON public.login_streaks FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Users can insert their own streaks"
  ON public.login_streaks FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update their own streaks"
  ON public.login_streaks FOR UPDATE
  USING (profile_id = auth.uid());

CREATE INDEX idx_login_streaks_profile ON public.login_streaks(profile_id);

-- 10. EMAIL REPLY LOGS (Debug trail for email parsing)
CREATE TABLE public.email_reply_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  email_from TEXT NOT NULL,
  email_subject TEXT,
  email_body TEXT NOT NULL,
  parsed_data JSONB,
  processing_status TEXT NOT NULL DEFAULT 'pending', -- pending, processed, failed
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.email_reply_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email reply logs"
  ON public.email_reply_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = true
  ));

CREATE INDEX idx_email_reply_logs_profile ON public.email_reply_logs(profile_id);
CREATE INDEX idx_email_reply_logs_status ON public.email_reply_logs(processing_status);

-- Create trigger for updated_at columns
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_leading_indicators_updated_at
  BEFORE UPDATE ON public.leading_indicators
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_resource_ratings_updated_at
  BEFORE UPDATE ON public.resource_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_capability_level_requests_updated_at
  BEFORE UPDATE ON public.capability_level_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_performance_reviews_updated_at
  BEFORE UPDATE ON public.performance_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_preferences_updated_at
  BEFORE UPDATE ON public.email_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_login_streaks_updated_at
  BEFORE UPDATE ON public.login_streaks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();