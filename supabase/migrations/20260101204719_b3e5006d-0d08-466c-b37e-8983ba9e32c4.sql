-- Add challenge completion tracking to podcast_episodes
ALTER TABLE public.podcast_episodes
ADD COLUMN challenge_completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;