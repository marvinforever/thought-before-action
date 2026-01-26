-- Create user_integrations table for OAuth connections
CREATE TABLE public.user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL, -- 'google', 'microsoft', 'slack', 'salesforce'
  access_token TEXT, -- Encrypted at rest by Supabase
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],
  external_user_id TEXT, -- Their Google/Slack/etc user ID
  external_email TEXT, -- Their connected account email
  metadata JSONB DEFAULT '{}',
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending', -- 'pending', 'syncing', 'synced', 'error'
  sync_error TEXT, -- Last error message if any
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, integration_type)
);

-- Enable RLS
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

-- Users can only view their own integrations
CREATE POLICY "Users can view own integrations"
  ON public.user_integrations
  FOR SELECT
  USING (profile_id = auth.uid());

-- Users can insert their own integrations
CREATE POLICY "Users can insert own integrations"
  ON public.user_integrations
  FOR INSERT
  WITH CHECK (profile_id = auth.uid());

-- Users can update their own integrations
CREATE POLICY "Users can update own integrations"
  ON public.user_integrations
  FOR UPDATE
  USING (profile_id = auth.uid());

-- Users can delete their own integrations
CREATE POLICY "Users can delete own integrations"
  ON public.user_integrations
  FOR DELETE
  USING (profile_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_user_integrations_updated_at
  BEFORE UPDATE ON public.user_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_user_integrations_profile_id ON public.user_integrations(profile_id);
CREATE INDEX idx_user_integrations_type ON public.user_integrations(integration_type);
CREATE INDEX idx_user_integrations_sync_status ON public.user_integrations(sync_status);