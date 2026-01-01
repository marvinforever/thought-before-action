-- Phase 1: Coaching Memory Infrastructure
-- Table for long-term coaching insights extracted from conversations

CREATE TABLE public.coaching_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('personality_trait', 'strength', 'growth_area', 'life_event', 'coaching_note', 'commitment', 'blocker', 'preference', 'relationship')),
  insight_text TEXT NOT NULL,
  source_conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  confidence_level TEXT DEFAULT 'medium' CHECK (confidence_level IN ('low', 'medium', 'high')),
  first_observed_at TIMESTAMPTZ DEFAULT now(),
  last_reinforced_at TIMESTAMPTZ DEFAULT now(),
  reinforcement_count INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table for conversation summaries (auto-generated after each conversation)
CREATE TABLE public.conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE UNIQUE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  key_topics TEXT[] DEFAULT '{}',
  action_items JSONB DEFAULT '[]',
  emotional_tone TEXT CHECK (emotional_tone IN ('stressed', 'neutral', 'energized', 'uncertain', 'frustrated', 'motivated', 'reflective')),
  follow_up_needed BOOLEAN DEFAULT false,
  follow_up_topic TEXT,
  follow_up_scheduled_for TIMESTAMPTZ,
  follow_up_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table for scheduled coaching follow-ups
CREATE TABLE public.coaching_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  follow_up_type TEXT NOT NULL CHECK (follow_up_type IN ('goal_check_in', 'commitment_reminder', 'life_event_check', 'habit_accountability', 'general_check_in')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  context JSONB NOT NULL DEFAULT '{}',
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  channel TEXT DEFAULT 'chat' CHECK (channel IN ('chat', 'sms', 'email', 'podcast')),
  completed_at TIMESTAMPTZ,
  skipped_at TIMESTAMPTZ,
  skip_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_coaching_insights_profile ON public.coaching_insights(profile_id) WHERE is_active = true;
CREATE INDEX idx_coaching_insights_type ON public.coaching_insights(insight_type) WHERE is_active = true;
CREATE INDEX idx_conversation_summaries_profile ON public.conversation_summaries(profile_id);
CREATE INDEX idx_conversation_summaries_follow_up ON public.conversation_summaries(profile_id) WHERE follow_up_needed = true AND follow_up_completed_at IS NULL;
CREATE INDEX idx_coaching_follow_ups_scheduled ON public.coaching_follow_ups(scheduled_for) WHERE completed_at IS NULL AND skipped_at IS NULL;
CREATE INDEX idx_coaching_follow_ups_profile ON public.coaching_follow_ups(profile_id) WHERE completed_at IS NULL;

-- Enable RLS
ALTER TABLE public.coaching_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_follow_ups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for coaching_insights (profiles.id = auth.uid())
CREATE POLICY "Users can view their own coaching insights"
  ON public.coaching_insights FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Service role can manage all coaching insights"
  ON public.coaching_insights FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for conversation_summaries
CREATE POLICY "Users can view their own conversation summaries"
  ON public.conversation_summaries FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Service role can manage all conversation summaries"
  ON public.conversation_summaries FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for coaching_follow_ups
CREATE POLICY "Users can view their own follow-ups"
  ON public.coaching_follow_ups FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Service role can manage all follow-ups"
  ON public.coaching_follow_ups FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');