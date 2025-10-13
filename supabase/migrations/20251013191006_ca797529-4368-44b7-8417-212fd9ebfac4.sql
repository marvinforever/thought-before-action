-- Add voice conversation tracking columns to conversations table
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'web' CHECK (source IN ('web', 'voice', 'email')),
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
ADD COLUMN IF NOT EXISTS transcript_summary TEXT;

CREATE INDEX IF NOT EXISTS idx_conversations_source_date 
ON conversations(source, created_at DESC);

COMMENT ON COLUMN conversations.source IS 'Source of the conversation: web (text chat), voice (voice chat), or email';
COMMENT ON COLUMN conversations.duration_seconds IS 'Duration of voice conversations in seconds';
COMMENT ON COLUMN conversations.transcript_summary IS 'AI-generated summary of voice conversation transcript';

-- Create voice_sessions table to track voice interaction metadata
CREATE TABLE IF NOT EXISTS voice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  audio_minutes_used DECIMAL(10,2),
  elevenlabs_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_voice_sessions_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_voice_sessions_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_voice_sessions_profile ON voice_sessions(profile_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_conversation ON voice_sessions(conversation_id);

COMMENT ON TABLE voice_sessions IS 'Tracks metadata about voice conversation sessions with Jericho';
COMMENT ON COLUMN voice_sessions.audio_minutes_used IS 'ElevenLabs audio usage in minutes for billing tracking';
COMMENT ON COLUMN voice_sessions.elevenlabs_session_id IS 'ElevenLabs session ID for support and debugging';

-- Enable RLS on voice_sessions
ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own voice sessions
CREATE POLICY "Users can view their own voice sessions"
ON voice_sessions
FOR SELECT
USING (auth.uid() = profile_id);

-- Policy: Users can insert their own voice sessions
CREATE POLICY "Users can insert their own voice sessions"
ON voice_sessions
FOR INSERT
WITH CHECK (auth.uid() = profile_id);

-- Policy: Users can update their own voice sessions
CREATE POLICY "Users can update their own voice sessions"
ON voice_sessions
FOR UPDATE
USING (auth.uid() = profile_id);

-- Policy: Managers can view their team's voice sessions
CREATE POLICY "Managers can view team voice sessions"
ON voice_sessions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM manager_assignments
    WHERE manager_id = auth.uid()
    AND employee_id = voice_sessions.profile_id
  )
);