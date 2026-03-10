-- Add missing columns to user_active_context
ALTER TABLE public.user_active_context
ADD COLUMN IF NOT EXISTS report_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS report_generated_at timestamptz;

-- Create growth_plans table
CREATE TABLE IF NOT EXISTS public.growth_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  generated_text text,
  capability_matrix jsonb,
  report_html text,
  report_url text,
  status text DEFAULT 'generating',
  model_used text,
  word_count integer,
  generated_at timestamptz DEFAULT now(),
  delivered_at timestamptz,
  delivery_method text DEFAULT 'email',
  error_log jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_growth_plans_profile_id ON public.growth_plans(profile_id);
CREATE INDEX IF NOT EXISTS idx_growth_plans_status ON public.growth_plans(status);

-- RLS
ALTER TABLE public.growth_plans ENABLE ROW LEVEL SECURITY;

-- Users can read their own growth plans
CREATE POLICY "Users can read own growth plans"
ON public.growth_plans FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

-- Service role handles inserts/updates (edge functions use service role key)
CREATE POLICY "Service role full access on growth_plans"
ON public.growth_plans FOR ALL
TO service_role
USING (true)
WITH CHECK (true);