-- Add podcast duration preference to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS podcast_duration_minutes integer DEFAULT 2;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.podcast_duration_minutes IS 'Preferred podcast duration: 2, 5, or 10 minutes';