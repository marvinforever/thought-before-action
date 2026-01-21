-- Add new columns for workflow and prompt data
ALTER TABLE employee_ai_recommendations 
  ADD COLUMN IF NOT EXISTS workflow_data JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS prompt_library JSONB DEFAULT '[]';

-- Create table to track AI prompt usage and adoption
CREATE TABLE IF NOT EXISTS ai_prompt_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  recommendation_id UUID REFERENCES employee_ai_recommendations(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  prompt_text TEXT,
  prompt_copied BOOLEAN DEFAULT false,
  jericho_practiced BOOLEAN DEFAULT false,
  marked_helpful BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on ai_prompt_usage
ALTER TABLE ai_prompt_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their own prompt usage
CREATE POLICY "Users can view their own prompt usage" 
ON ai_prompt_usage 
FOR SELECT 
USING (auth.uid() = profile_id);

-- Users can insert their own prompt usage
CREATE POLICY "Users can insert their own prompt usage" 
ON ai_prompt_usage 
FOR INSERT 
WITH CHECK (auth.uid() = profile_id);

-- Users can update their own prompt usage
CREATE POLICY "Users can update their own prompt usage" 
ON ai_prompt_usage 
FOR UPDATE 
USING (auth.uid() = profile_id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_prompt_usage_profile ON ai_prompt_usage(profile_id);
CREATE INDEX IF NOT EXISTS idx_ai_prompt_usage_recommendation ON ai_prompt_usage(recommendation_id);