-- Add new columns to podcast_episodes for enhanced tracking
ALTER TABLE public.podcast_episodes 
ADD COLUMN IF NOT EXISTS capability_id uuid REFERENCES public.capabilities(id),
ADD COLUMN IF NOT EXISTS daily_challenge text,
ADD COLUMN IF NOT EXISTS capability_focus_index integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS yesterday_summary text;

-- Add index for capability rotation queries
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_capability_focus ON public.podcast_episodes(profile_id, capability_focus_index);

COMMENT ON COLUMN public.podcast_episodes.capability_id IS 'The capability featured in this episode for rotation tracking';
COMMENT ON COLUMN public.podcast_episodes.daily_challenge IS 'The specific challenge given in this episode for next-day callback';
COMMENT ON COLUMN public.podcast_episodes.capability_focus_index IS 'Index tracking which capability in rotation was used';
COMMENT ON COLUMN public.podcast_episodes.yesterday_summary IS 'Brief summary of yesterday episode for continuity';