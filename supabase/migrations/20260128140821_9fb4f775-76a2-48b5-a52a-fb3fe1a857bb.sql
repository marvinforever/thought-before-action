-- Add podcast feedback table for self-learning
CREATE TABLE public.podcast_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  episode_id UUID NOT NULL REFERENCES public.podcast_episodes(id) ON DELETE CASCADE,
  rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
  feedback_text TEXT,
  context_snapshot JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add podcast learning table for aggregating feedback patterns
CREATE TABLE public.podcast_learning (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL,
  pattern_key TEXT NOT NULL,
  learned_response TEXT NOT NULL,
  confidence_score NUMERIC(3,2) DEFAULT 0.5,
  feedback_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, pattern_type, pattern_key)
);

-- Add streak_history column to leading_indicators for tracking cap-out patterns
ALTER TABLE public.leading_indicators 
ADD COLUMN IF NOT EXISTS streak_history JSONB DEFAULT '[]';

-- Enable RLS on new tables
ALTER TABLE public.podcast_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.podcast_learning ENABLE ROW LEVEL SECURITY;

-- RLS policies for podcast_feedback
CREATE POLICY "Users can view their own feedback"
  ON public.podcast_feedback FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can create their own feedback"
  ON public.podcast_feedback FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

-- RLS policies for podcast_learning (company-level)
CREATE POLICY "Users can view company learnings"
  ON public.podcast_learning FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Create trigger for updating updated_at on podcast_learning
CREATE TRIGGER update_podcast_learning_updated_at
  BEFORE UPDATE ON public.podcast_learning
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_podcast_feedback_profile_id ON public.podcast_feedback(profile_id);
CREATE INDEX idx_podcast_feedback_episode_id ON public.podcast_feedback(episode_id);
CREATE INDEX idx_podcast_learning_company_pattern ON public.podcast_learning(company_id, pattern_type);