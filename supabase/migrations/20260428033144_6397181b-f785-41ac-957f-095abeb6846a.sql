
-- friday_debriefs
CREATE TABLE public.friday_debriefs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_of DATE NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'voice', 'web', 'sms')),
  raw_response TEXT,
  transcript TEXT,
  wins_text TEXT,
  stuck_text TEXT,
  focus_text TEXT,
  need_text TEXT,
  extracted_themes JSONB DEFAULT '[]'::jsonb,
  category_scores JSONB DEFAULT '{}'::jsonb,
  narrative_summary TEXT,
  audio_url TEXT,
  processed_at TIMESTAMPTZ,
  jericho_reply_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, week_of)
);
CREATE INDEX idx_friday_debriefs_profile_week ON public.friday_debriefs (profile_id, week_of DESC);
CREATE INDEX idx_friday_debriefs_week ON public.friday_debriefs (week_of DESC);
ALTER TABLE public.friday_debriefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own debriefs" ON public.friday_debriefs FOR SELECT
  USING (auth.uid() = profile_id OR public.is_super_admin(auth.uid()));
CREATE POLICY "Users insert own debriefs" ON public.friday_debriefs FOR INSERT
  WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users update own debriefs" ON public.friday_debriefs FOR UPDATE
  USING (auth.uid() = profile_id OR public.is_super_admin(auth.uid()));
CREATE POLICY "Users delete own debriefs" ON public.friday_debriefs FOR DELETE
  USING (auth.uid() = profile_id OR public.is_super_admin(auth.uid()));
CREATE TRIGGER friday_debriefs_updated_at BEFORE UPDATE ON public.friday_debriefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- friday_debrief_invites
CREATE TABLE public.friday_debrief_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_of DATE NOT NULL,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel_invited TEXT NOT NULL DEFAULT 'email',
  responded_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  skipped BOOLEAN NOT NULL DEFAULT false,
  message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, week_of)
);
CREATE INDEX idx_friday_debrief_invites_profile_week ON public.friday_debrief_invites (profile_id, week_of DESC);
CREATE INDEX idx_friday_debrief_invites_message_id ON public.friday_debrief_invites (message_id) WHERE message_id IS NOT NULL;
ALTER TABLE public.friday_debrief_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own invites" ON public.friday_debrief_invites FOR SELECT
  USING (auth.uid() = profile_id OR public.is_super_admin(auth.uid()));
CREATE POLICY "Users update own invites" ON public.friday_debrief_invites FOR UPDATE
  USING (auth.uid() = profile_id OR public.is_super_admin(auth.uid()));

-- friday_debrief_streaks
CREATE TABLE public.friday_debrief_streaks (
  profile_id UUID NOT NULL PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_debrief_week DATE,
  total_debriefs INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.friday_debrief_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own streak" ON public.friday_debrief_streaks FOR SELECT
  USING (auth.uid() = profile_id OR public.is_super_admin(auth.uid()));
CREATE TRIGGER friday_debrief_streaks_updated_at BEFORE UPDATE ON public.friday_debrief_streaks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Extend user_active_context
ALTER TABLE public.user_active_context
  ADD COLUMN IF NOT EXISTS friday_debrief_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS friday_debrief_day_time TEXT NOT NULL DEFAULT 'fri_9am',
  ADD COLUMN IF NOT EXISTS friday_debrief_share_with_manager BOOLEAN NOT NULL DEFAULT true;

-- Manager aggregate function (themes + scores only, never raw text)
CREATE OR REPLACE FUNCTION public.get_team_debrief_aggregates(
  p_manager_id UUID,
  p_weeks_back INTEGER DEFAULT 4
)
RETURNS TABLE (
  profile_id UUID,
  full_name TEXT,
  weeks_completed INTEGER,
  current_streak INTEGER,
  avg_wins NUMERIC,
  avg_stuck NUMERIC,
  avg_focus NUMERIC,
  avg_asks NUMERIC,
  avg_vibe NUMERIC,
  recent_themes JSONB
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH authorized AS (
    SELECT DISTINCT ma.employee_id AS pid
    FROM public.manager_assignments ma
    JOIN public.user_active_context uac ON uac.profile_id = ma.employee_id
    WHERE ma.manager_id = p_manager_id
      AND uac.friday_debrief_share_with_manager = true
  ),
  recent AS (
    SELECT fd.profile_id, fd.category_scores, fd.extracted_themes, fd.week_of
    FROM public.friday_debriefs fd
    WHERE fd.profile_id IN (SELECT pid FROM authorized)
      AND fd.week_of >= CURRENT_DATE - (p_weeks_back * 7)
  )
  SELECT
    p.id,
    p.full_name,
    COUNT(r.week_of)::INTEGER,
    COALESCE(s.current_streak, 0),
    AVG((r.category_scores->>'wins')::NUMERIC),
    AVG((r.category_scores->>'stuck')::NUMERIC),
    AVG((r.category_scores->>'focus')::NUMERIC),
    AVG((r.category_scores->>'asks')::NUMERIC),
    AVG((r.category_scores->>'vibe')::NUMERIC),
    COALESCE(jsonb_agg(DISTINCT t.theme_label) FILTER (WHERE t.theme_label IS NOT NULL), '[]'::jsonb)
  FROM public.profiles p
  LEFT JOIN recent r ON r.profile_id = p.id
  LEFT JOIN public.friday_debrief_streaks s ON s.profile_id = p.id
  LEFT JOIN LATERAL jsonb_array_elements_text(r.extracted_themes) AS t(theme_label) ON true
  WHERE p.id IN (SELECT pid FROM authorized)
  GROUP BY p.id, p.full_name, s.current_streak;
$$;
