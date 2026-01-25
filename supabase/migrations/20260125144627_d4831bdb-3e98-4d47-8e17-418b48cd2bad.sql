-- ============================================================================
-- CAREER PATHING SYSTEM TABLES
-- ============================================================================

-- Career path definitions (company-specific role progressions)
CREATE TABLE public.career_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Path definition
  name TEXT NOT NULL, -- e.g., "Engineering Leadership Track"
  description TEXT,
  path_type TEXT NOT NULL DEFAULT 'individual_contributor', -- 'individual_contributor', 'management', 'specialist'
  
  -- Source and target roles
  from_role TEXT, -- Starting role (null = entry level)
  to_role TEXT NOT NULL, -- Target role
  
  -- Requirements
  required_capabilities JSONB DEFAULT '[]', -- Array of {capability_id, min_level}
  typical_timeline_months INTEGER, -- Expected time to achieve
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Career aspirations detected from conversations
CREATE TABLE public.career_aspirations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Aspiration details
  aspiration_text TEXT NOT NULL, -- The raw text expressing the aspiration
  aspiration_type TEXT NOT NULL, -- 'role', 'skill', 'responsibility', 'industry', 'general'
  target_role TEXT, -- Extracted target role if applicable
  
  -- AI analysis
  confidence_score NUMERIC(3,2), -- 0.00 to 1.00
  keywords TEXT[], -- Extracted career keywords
  sentiment TEXT, -- 'eager', 'curious', 'uncertain', 'frustrated'
  
  -- Source tracking
  source_type TEXT NOT NULL DEFAULT 'chat', -- 'chat', 'survey', 'one_on_one', 'manual'
  source_conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  acknowledged_at TIMESTAMPTZ, -- When manager acknowledged
  acknowledged_by UUID REFERENCES public.profiles(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Promotion readiness assessments
CREATE TABLE public.promotion_readiness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  career_path_id UUID REFERENCES public.career_paths(id) ON DELETE SET NULL,
  
  -- Target
  target_role TEXT NOT NULL,
  
  -- Readiness scores
  overall_readiness_pct INTEGER NOT NULL, -- 0-100
  capability_readiness_pct INTEGER, -- Based on required capabilities
  experience_readiness_pct INTEGER, -- Based on time/achievements
  performance_readiness_pct INTEGER, -- Based on recent performance
  
  -- Gap analysis
  capability_gaps JSONB DEFAULT '[]', -- Array of {capability_id, current_level, required_level, gap_severity}
  strengths JSONB DEFAULT '[]', -- Array of {capability_id, level, notes}
  
  -- AI-generated insights
  readiness_summary TEXT,
  recommended_actions JSONB DEFAULT '[]', -- Array of {action, priority, estimated_time}
  estimated_ready_date DATE,
  
  -- Assessment metadata
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assessed_by TEXT NOT NULL DEFAULT 'ai', -- 'ai', 'manager', 'self'
  next_assessment_due DATE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure one active assessment per profile+path combination
  CONSTRAINT unique_active_readiness UNIQUE (profile_id, career_path_id)
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.career_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_aspirations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_readiness ENABLE ROW LEVEL SECURITY;

-- Career Paths: Company members can view, admins can manage
CREATE POLICY "Company members can view career paths"
  ON public.career_paths FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Company admins can manage career paths"
  ON public.career_paths FOR ALL
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- Career Aspirations: Users own their aspirations, managers can view team via manager_assignments
CREATE POLICY "Users can view own aspirations"
  ON public.career_aspirations FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Managers can view team aspirations"
  ON public.career_aspirations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.manager_assignments ma
      WHERE ma.employee_id = career_aspirations.profile_id 
      AND ma.manager_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all company aspirations"
  ON public.career_aspirations FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Users can manage own aspirations"
  ON public.career_aspirations FOR ALL
  USING (profile_id = auth.uid());

CREATE POLICY "Service role can insert aspirations"
  ON public.career_aspirations FOR INSERT
  WITH CHECK (true);

-- Promotion Readiness: Users see own, managers see team via manager_assignments
CREATE POLICY "Users can view own readiness"
  ON public.promotion_readiness FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Managers can view team readiness"
  ON public.promotion_readiness FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.manager_assignments ma
      WHERE ma.employee_id = promotion_readiness.profile_id 
      AND ma.manager_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all company readiness"
  ON public.promotion_readiness FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Service role can manage readiness"
  ON public.promotion_readiness FOR ALL
  USING (true);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_career_paths_company ON public.career_paths(company_id, is_active);
CREATE INDEX idx_career_aspirations_profile ON public.career_aspirations(profile_id, is_active);
CREATE INDEX idx_career_aspirations_company ON public.career_aspirations(company_id, created_at DESC);
CREATE INDEX idx_promotion_readiness_profile ON public.promotion_readiness(profile_id);
CREATE INDEX idx_promotion_readiness_company ON public.promotion_readiness(company_id, overall_readiness_pct DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_career_paths_updated_at
  BEFORE UPDATE ON public.career_paths
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_career_aspirations_updated_at
  BEFORE UPDATE ON public.career_aspirations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_promotion_readiness_updated_at
  BEFORE UPDATE ON public.promotion_readiness
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();