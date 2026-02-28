-- Add missing OAuth columns to user_integrations
ALTER TABLE public.user_integrations
ADD COLUMN IF NOT EXISTS provider text,
ADD COLUMN IF NOT EXISTS last_refreshed_at timestamptz,
ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
ADD COLUMN IF NOT EXISTS oauth_state text;

-- Index for state token lookups during OAuth callback
CREATE INDEX IF NOT EXISTS idx_user_integrations_oauth_state ON public.user_integrations(oauth_state) WHERE oauth_state IS NOT NULL;

-- Service role policy for edge functions to manage integrations
CREATE POLICY "Service role full access on user_integrations"
  ON public.user_integrations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);