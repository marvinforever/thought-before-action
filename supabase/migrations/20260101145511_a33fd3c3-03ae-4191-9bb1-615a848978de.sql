-- Create podcast_episodes table for storing daily personalized podcasts
CREATE TABLE public.podcast_episodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  episode_date DATE NOT NULL,
  title TEXT NOT NULL,
  script TEXT NOT NULL,
  audio_url TEXT,
  duration_seconds INTEGER,
  content_type TEXT NOT NULL DEFAULT 'hybrid',
  topics_covered JSONB DEFAULT '[]'::jsonb,
  listened_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_episode_per_day UNIQUE (profile_id, episode_date)
);

-- Enable Row Level Security
ALTER TABLE public.podcast_episodes ENABLE ROW LEVEL SECURITY;

-- Users can view their own episodes
CREATE POLICY "Users can view their own podcast episodes"
ON public.podcast_episodes
FOR SELECT
USING (auth.uid() = profile_id);

-- Users can update their own episodes (for marking as listened)
CREATE POLICY "Users can update their own podcast episodes"
ON public.podcast_episodes
FOR UPDATE
USING (auth.uid() = profile_id);

-- Service role can insert episodes (for edge function)
CREATE POLICY "Service role can insert podcast episodes"
ON public.podcast_episodes
FOR INSERT
WITH CHECK (true);

-- Create storage bucket for podcast audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('podcasts', 'podcasts', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for podcast audio
CREATE POLICY "Podcast audio is publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'podcasts');

CREATE POLICY "Service role can upload podcast audio"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'podcasts');

-- Add trigger for updated_at
CREATE TRIGGER update_podcast_episodes_updated_at
BEFORE UPDATE ON public.podcast_episodes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();