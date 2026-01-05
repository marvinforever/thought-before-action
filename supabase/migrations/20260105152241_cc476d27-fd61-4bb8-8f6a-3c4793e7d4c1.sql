-- Add registration tracking columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS registration_complete boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS created_by_admin boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS job_title text;

-- Create registration_metadata table for storing onboarding info
CREATE TABLE IF NOT EXISTS public.registration_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  company_name text,
  primary_goal text,
  goal_details text,
  attribution_source text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.registration_metadata ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own registration metadata
CREATE POLICY "Users can view own registration metadata"
ON public.registration_metadata FOR SELECT
USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert own registration metadata"
ON public.registration_metadata FOR INSERT
WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update own registration metadata"
ON public.registration_metadata FOR UPDATE
USING (auth.uid() = profile_id);

-- Add is_welcome_episode to podcast_episodes if not exists
ALTER TABLE public.podcast_episodes
ADD COLUMN IF NOT EXISTS is_welcome_episode boolean DEFAULT false;

-- Mark existing profiles as registration complete (they're already using the app)
UPDATE public.profiles SET registration_complete = true WHERE registration_complete IS NULL OR registration_complete = false;