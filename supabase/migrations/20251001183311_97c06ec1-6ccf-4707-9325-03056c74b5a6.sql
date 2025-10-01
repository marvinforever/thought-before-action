-- Add fields to capabilities table for custom capability support
ALTER TABLE public.capabilities 
ADD COLUMN IF NOT EXISTS is_custom boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS created_by_company_id uuid REFERENCES public.companies(id),
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS companies_using_count integer DEFAULT 0;

-- Create custom_capabilities table for AI-generated capabilities pending approval
CREATE TABLE IF NOT EXISTS public.custom_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  description text,
  full_description text,
  company_id uuid REFERENCES public.companies(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_by_job_description text,
  ai_confidence_score numeric,
  created_at timestamp with time zone DEFAULT now(),
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamp with time zone,
  rejection_reason text
);

-- Create capability_levels_pending for custom capabilities
CREATE TABLE IF NOT EXISTS public.capability_levels_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_capability_id uuid REFERENCES public.custom_capabilities(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('foundational', 'advancing', 'independent', 'mastery')),
  description text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Create capability_usage_stats to track cross-company usage
CREATE TABLE IF NOT EXISTS public.capability_usage_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_id uuid REFERENCES public.capabilities(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  usage_count integer DEFAULT 1,
  first_used_at timestamp with time zone DEFAULT now(),
  last_used_at timestamp with time zone DEFAULT now(),
  UNIQUE(capability_id, company_id)
);

-- Create capability_resource_gaps to flag capabilities without resources
CREATE TABLE IF NOT EXISTS public.capability_resource_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_id uuid REFERENCES public.capabilities(id) ON DELETE CASCADE,
  flagged_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone,
  resolved_by uuid REFERENCES public.profiles(id),
  UNIQUE(capability_id)
);

-- Enable RLS on new tables
ALTER TABLE public.custom_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_levels_pending ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_resource_gaps ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_capabilities
CREATE POLICY "Super admins can view all custom capabilities"
  ON public.custom_capabilities FOR SELECT
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage custom capabilities"
  ON public.custom_capabilities FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- RLS Policies for capability_levels_pending
CREATE POLICY "Super admins can view capability levels pending"
  ON public.capability_levels_pending FOR SELECT
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage capability levels pending"
  ON public.capability_levels_pending FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- RLS Policies for capability_usage_stats
CREATE POLICY "Super admins can view usage stats"
  ON public.capability_usage_stats FOR SELECT
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage usage stats"
  ON public.capability_usage_stats FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- RLS Policies for capability_resource_gaps
CREATE POLICY "Super admins can view resource gaps"
  ON public.capability_resource_gaps FOR SELECT
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage resource gaps"
  ON public.capability_resource_gaps FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- Create function to auto-promote capabilities to watchlist
CREATE OR REPLACE FUNCTION public.check_capability_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  usage_count integer;
BEGIN
  -- Count distinct companies using this capability
  SELECT COUNT(DISTINCT company_id) INTO usage_count
  FROM public.capability_usage_stats
  WHERE capability_id = NEW.capability_id;
  
  -- Update companies_using_count on capabilities table
  UPDATE public.capabilities
  SET companies_using_count = usage_count
  WHERE id = NEW.capability_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-promotion
DROP TRIGGER IF EXISTS trigger_check_capability_promotion ON public.capability_usage_stats;
CREATE TRIGGER trigger_check_capability_promotion
  AFTER INSERT OR UPDATE ON public.capability_usage_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.check_capability_promotion();