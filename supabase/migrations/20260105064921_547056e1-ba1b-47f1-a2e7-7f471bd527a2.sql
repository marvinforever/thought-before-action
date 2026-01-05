-- Add columns to email_preferences for daily brief configuration
ALTER TABLE public.email_preferences 
ADD COLUMN IF NOT EXISTS include_podcast boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS brief_format text DEFAULT 'both' CHECK (brief_format IN ('audio', 'text', 'both'));