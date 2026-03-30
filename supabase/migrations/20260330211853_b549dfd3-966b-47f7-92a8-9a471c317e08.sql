
-- Track interactions with playbook sections (resources, quick wins, capabilities, priorities)
CREATE TABLE public.playbook_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL, -- 'resource', 'quick_win', 'capability', 'priority_action'
  section_key TEXT NOT NULL, -- title or identifier of the section item
  interaction_type TEXT NOT NULL, -- 'completed', 'accepted', 'rejected', 'skipped', 'feedback', 'started'
  feedback_text TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups per user
CREATE INDEX idx_playbook_interactions_profile ON public.playbook_interactions(profile_id);
CREATE INDEX idx_playbook_interactions_section ON public.playbook_interactions(profile_id, section_type, section_key);

-- RLS
ALTER TABLE public.playbook_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own interactions"
  ON public.playbook_interactions FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Users can insert own interactions"
  ON public.playbook_interactions FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update own interactions"
  ON public.playbook_interactions FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid());
