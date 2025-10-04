-- Phase 3: Enhanced Resource Recommendations

-- 1. Add expires_at to content_recommendations
ALTER TABLE content_recommendations 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Set default expiration to 45 days from sent_at for existing records
UPDATE content_recommendations 
SET expires_at = sent_at + INTERVAL '45 days'
WHERE expires_at IS NULL AND sent_at IS NOT NULL;

-- 2. Create resource_suggestions table for user-submitted resources
CREATE TABLE IF NOT EXISTS resource_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  external_url TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('book', 'video', 'podcast', 'course', 'article')),
  suggested_capability_id UUID REFERENCES capabilities(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on resource_suggestions
ALTER TABLE resource_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS policies for resource_suggestions
CREATE POLICY "Users can insert their own suggestions"
  ON resource_suggestions FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can view their own suggestions"
  ON resource_suggestions FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Admins can view all suggestions in their company"
  ON resource_suggestions FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM profiles 
    WHERE id = auth.uid() AND is_admin = true
  ));

CREATE POLICY "Admins can update suggestions in their company"
  ON resource_suggestions FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM profiles 
    WHERE id = auth.uid() AND is_admin = true
  ));

-- 3. Add index for faster expiration queries
CREATE INDEX IF NOT EXISTS idx_content_recommendations_expires_at 
ON content_recommendations(expires_at) 
WHERE status != 'completed';

-- 4. Add updated_at trigger for resource_suggestions
CREATE TRIGGER update_resource_suggestions_updated_at
  BEFORE UPDATE ON resource_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();