-- Add music URL columns to podcast_episodes
ALTER TABLE public.podcast_episodes 
ADD COLUMN IF NOT EXISTS intro_music_url text,
ADD COLUMN IF NOT EXISTS outro_music_url text;