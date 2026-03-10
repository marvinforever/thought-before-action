CREATE TABLE IF NOT EXISTS public.try_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token text UNIQUE NOT NULL,
  referrer_url text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  entry_timestamp timestamptz DEFAULT now(),
  last_activity timestamptz DEFAULT now(),
  conversation_history jsonb DEFAULT '[]'::jsonb,
  extracted_data jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'active',
  profile_id uuid REFERENCES profiles(id),
  company_match_id uuid REFERENCES companies(id),
  messages_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_try_sessions_token ON try_sessions(session_token);

CREATE INDEX idx_try_sessions_company ON try_sessions(company_match_id) 
  WHERE company_match_id IS NOT NULL;

ALTER TABLE public.try_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on try_sessions"
  ON public.try_sessions FOR ALL USING (true) WITH CHECK (true);