-- =============================================
-- PHASE 0.1: Feature Flags System
-- =============================================

-- Create feature_flags table (global flag definitions)
CREATE TABLE public.feature_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create company_feature_flags table (per-company overrides)
CREATE TABLE public.company_feature_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  flag_id UUID NOT NULL REFERENCES public.feature_flags(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  enabled_at TIMESTAMP WITH TIME ZONE,
  enabled_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, flag_id)
);

-- Create user_feature_flags table (per-user overrides for beta testers)
CREATE TABLE public.user_feature_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  flag_id UUID NOT NULL REFERENCES public.feature_flags(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  enabled_at TIMESTAMP WITH TIME ZONE,
  enabled_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(profile_id, flag_id)
);

-- Enable RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feature_flags ENABLE ROW LEVEL SECURITY;

-- Feature flags are readable by all authenticated users
CREATE POLICY "Feature flags are readable by authenticated users"
ON public.feature_flags FOR SELECT
TO authenticated
USING (true);

-- Only super_admins can modify feature flags
CREATE POLICY "Super admins can manage feature flags"
ON public.feature_flags FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
  )
);

-- Company feature flags readable by company members
CREATE POLICY "Company members can view their company feature flags"
ON public.company_feature_flags FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Super admins and company admins can manage company feature flags
CREATE POLICY "Admins can manage company feature flags"
ON public.company_feature_flags FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin', 'admin')
  )
);

-- User feature flags readable by the user themselves
CREATE POLICY "Users can view their own feature flags"
ON public.user_feature_flags FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

-- Super admins can manage all user feature flags
CREATE POLICY "Super admins can manage user feature flags"
ON public.user_feature_flags FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
  )
);

-- Insert initial feature flags
INSERT INTO public.feature_flags (flag_name, description, is_enabled) VALUES
  ('sms_engagement', 'SMS two-way communication for growth plan updates', false),
  ('daily_podcast', 'AI-generated daily micro-podcast briefings', false),
  ('outbound_voice_calls', 'Jericho can make outbound voice calls to users', false),
  ('calendar_integration', 'Google/Outlook calendar sync for context', false),
  ('executive_assistant', 'Pre-meeting prep and executive assistant features', false),
  ('diagnostic_pulse_sms', 'Send diagnostic pulse questions via SMS', false);

-- Create updated_at trigger for feature_flags
CREATE TRIGGER update_feature_flags_updated_at
BEFORE UPDATE ON public.feature_flags
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();