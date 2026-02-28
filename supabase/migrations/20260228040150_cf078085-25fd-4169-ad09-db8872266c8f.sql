CREATE TABLE IF NOT EXISTS public.user_active_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id),
  last_conversation_summary text,
  last_interaction_at timestamptz,
  last_channel text,
  open_loops jsonb DEFAULT '[]',
  hot_customers jsonb DEFAULT '[]',
  pending_actions jsonb DEFAULT '[]',
  user_commitments jsonb DEFAULT '[]',
  emotional_state text,
  current_sprint_focus text,
  onboarding_complete boolean DEFAULT false,
  onboarding_step integer DEFAULT 0,
  onboarding_path text,
  onboarding_data jsonb DEFAULT '{}',
  is_free_tier boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(profile_id)
);

CREATE INDEX IF NOT EXISTS idx_user_active_context_profile_id ON user_active_context(profile_id);
CREATE INDEX IF NOT EXISTS idx_user_active_context_company_id ON user_active_context(company_id);

ALTER TABLE public.user_active_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own context" ON public.user_active_context FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can update own context" ON public.user_active_context FOR UPDATE USING (auth.uid() = profile_id);
CREATE POLICY "Users can insert own context" ON public.user_active_context FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Service role full access" ON public.user_active_context FOR ALL USING (true) WITH CHECK (true);