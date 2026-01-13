-- Create table for public AI readiness assessments (lead generation)
CREATE TABLE public.ai_readiness_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Lead capture info
  email text NOT NULL,
  name text,
  company_name text,
  phone text,
  
  -- Job descriptions (1-5)
  job_descriptions jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Current AI usage
  current_ai_tools text[] DEFAULT '{}',
  current_ai_workflows text,
  
  -- Analysis results
  analysis_results jsonb,
  executive_summary jsonb,
  total_hours_saved numeric DEFAULT 0,
  ai_readiness_score numeric DEFAULT 0,
  
  -- Tracking
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referral_code text,
  
  -- Status
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'complete', 'error')),
  share_token text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  error_message text,
  
  created_at timestamptz DEFAULT now(),
  analyzed_at timestamptz
);

-- Create index for share token lookups
CREATE INDEX idx_ai_readiness_assessments_share_token ON public.ai_readiness_assessments(share_token);

-- Create index for email lookups
CREATE INDEX idx_ai_readiness_assessments_email ON public.ai_readiness_assessments(email);

-- Enable RLS
ALTER TABLE public.ai_readiness_assessments ENABLE ROW LEVEL SECURITY;

-- Public can insert (lead capture)
CREATE POLICY "Anyone can create assessments"
ON public.ai_readiness_assessments
FOR INSERT
WITH CHECK (true);

-- Public can read their own assessment by share token
CREATE POLICY "Anyone can read assessments by share token"
ON public.ai_readiness_assessments
FOR SELECT
USING (true);

-- Create table for AI usage profiles (for internal employees)
CREATE TABLE public.ai_usage_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  lead_assessment_id uuid REFERENCES public.ai_readiness_assessments(id) ON DELETE CASCADE,
  current_tools text[] DEFAULT '{}',
  current_workflows text,
  estimated_current_weekly_ai_hours numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_usage_profiles ENABLE ROW LEVEL SECURITY;

-- Users can manage their own profiles
CREATE POLICY "Users can manage their own AI usage profiles"
ON public.ai_usage_profiles
FOR ALL
USING (auth.uid() = profile_id)
WITH CHECK (auth.uid() = profile_id);

-- Admins can view all in their company
CREATE POLICY "Admins can view company AI usage profiles"
ON public.ai_usage_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p1
    JOIN public.profiles p2 ON p1.company_id = p2.company_id
    WHERE p1.id = auth.uid() 
    AND p1.is_admin = true
    AND p2.id = ai_usage_profiles.profile_id
  )
);