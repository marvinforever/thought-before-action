-- Create AI usage logging table for cost tracking and monitoring
CREATE TABLE public.ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  function_name TEXT NOT NULL,
  model_used TEXT NOT NULL,
  model_provider TEXT NOT NULL DEFAULT 'lovable',
  task_type TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER GENERATED ALWAYS AS (COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)) STORED,
  estimated_cost_usd NUMERIC(10, 6),
  latency_ms INTEGER,
  was_fallback BOOLEAN DEFAULT false,
  fallback_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Super admins can view all usage
CREATE POLICY "Super admins can view all AI usage"
  ON public.ai_usage_log
  FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- Company admins can view their company's usage
CREATE POLICY "Company admins can view company AI usage"
  ON public.ai_usage_log
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Edge functions can insert (service role)
CREATE POLICY "Service role can insert AI usage"
  ON public.ai_usage_log
  FOR INSERT
  WITH CHECK (true);

-- Create index for common queries
CREATE INDEX idx_ai_usage_log_company_date ON public.ai_usage_log(company_id, created_at DESC);
CREATE INDEX idx_ai_usage_log_function ON public.ai_usage_log(function_name, created_at DESC);
CREATE INDEX idx_ai_usage_log_model ON public.ai_usage_log(model_used, created_at DESC);

-- Create monthly cost summary view
CREATE OR REPLACE VIEW public.ai_monthly_costs AS
SELECT 
  company_id,
  date_trunc('month', created_at) as month,
  model_provider,
  model_used,
  COUNT(*) as call_count,
  SUM(total_tokens) as total_tokens,
  SUM(estimated_cost_usd) as total_cost_usd
FROM public.ai_usage_log
GROUP BY company_id, date_trunc('month', created_at), model_provider, model_used;