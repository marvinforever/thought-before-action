-- Add source field to conversations table to track origin (web vs email)
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'web';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversations_source ON conversations(source);
CREATE INDEX IF NOT EXISTS idx_conversations_profile_source ON conversations(profile_id, source, updated_at DESC);