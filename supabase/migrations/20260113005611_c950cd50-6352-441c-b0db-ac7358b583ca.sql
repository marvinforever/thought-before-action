-- =============================================
-- PODCAST VARIETY SYSTEM & INDUSTRY NEWS
-- =============================================

-- 1. Create podcast_content_usage table for tracking what's been mentioned
CREATE TABLE public.podcast_content_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content_type text NOT NULL, -- 'achievement', 'recognition_received', 'recognition_given', 'goal', 'badge', 'habit_milestone', 'diagnostic'
  content_id uuid, -- references the specific item (achievement.id, recognition.id, etc.)
  content_hash text, -- for text-based items, hash of content for deduplication
  mentioned_at timestamptz DEFAULT now() NOT NULL,
  episode_date date NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add unique constraint to prevent duplicate mentions on same day
ALTER TABLE public.podcast_content_usage 
  ADD CONSTRAINT unique_content_per_day UNIQUE(profile_id, content_type, content_id, episode_date);

-- Create index for fast lookups
CREATE INDEX idx_content_usage_lookup ON public.podcast_content_usage(profile_id, content_type, mentioned_at);
CREATE INDEX idx_content_usage_profile ON public.podcast_content_usage(profile_id);

-- Enable RLS
ALTER TABLE public.podcast_content_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can see their own usage, service role can manage all
CREATE POLICY "Users can view their own content usage" 
  ON public.podcast_content_usage 
  FOR SELECT 
  USING (auth.uid() = profile_id);

CREATE POLICY "Service role can manage all content usage"
  ON public.podcast_content_usage
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2. Add industry columns to companies table
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS industry text DEFAULT 'general';

ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS industry_keywords jsonb DEFAULT '[]'::jsonb;

-- 3. Create daily_industry_news cache table
CREATE TABLE public.daily_industry_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry text NOT NULL,
  news_date date NOT NULL DEFAULT CURRENT_DATE,
  news_items jsonb NOT NULL,
  capability_context text, -- optional capability focus used in the search
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(industry, news_date)
);

-- Enable RLS
ALTER TABLE public.daily_industry_news ENABLE ROW LEVEL SECURITY;

-- Allow public read access to cached news
CREATE POLICY "Anyone can read industry news cache"
  ON public.daily_industry_news
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage industry news"
  ON public.daily_industry_news
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Update existing ag companies with industry info
UPDATE public.companies 
SET 
  industry = 'agricultural_retail',
  industry_keywords = '["agriculture", "crop protection", "fertilizer", "seed", "agronomy", "farm", "grain", "precision agriculture"]'::jsonb
WHERE 
  name ILIKE '%stateline%' 
  OR name ILIKE '%winfield%' 
  OR name ILIKE '%cdf%'
  OR name ILIKE '%ag partners%'
  OR name ILIKE '%logan%'
  OR name ILIKE '%mcm%'
  OR name ILIKE '%ias%'
  OR name ILIKE '%slc%';