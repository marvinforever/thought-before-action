-- ============================================
-- JERICHO AGENTIC SALES ASSISTANT TABLES
-- ============================================

-- 1. Sales Company Intelligence - Deep customer profiles built over time
CREATE TABLE public.sales_company_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.sales_companies(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    key_contacts JSONB DEFAULT '[]'::jsonb,
    buying_signals JSONB DEFAULT '[]'::jsonb,
    objections_history JSONB DEFAULT '[]'::jsonb,
    preferences JSONB DEFAULT '{}'::jsonb,
    relationship_notes TEXT,
    competitive_intel TEXT,
    personal_details JSONB DEFAULT '{}'::jsonb,
    research_data JSONB DEFAULT '{}'::jsonb,
    last_research_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(company_id, profile_id)
);

-- 2. Jericho Action Log - Audit trail for all autonomous actions (enables undo)
CREATE TABLE public.jericho_action_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    action_data JSONB DEFAULT '{}'::jsonb,
    triggered_by TEXT,
    can_undo BOOLEAN DEFAULT true,
    undone_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Email Drafts - AI-drafted emails ready for user review
CREATE TABLE public.email_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES public.sales_deals(id) ON DELETE SET NULL,
    sales_company_id UUID REFERENCES public.sales_companies(id) ON DELETE SET NULL,
    recipient_name TEXT,
    recipient_email TEXT,
    subject TEXT NOT NULL,
    body_text TEXT NOT NULL,
    personalization_context TEXT,
    current_events_used JSONB DEFAULT '[]'::jsonb,
    email_type TEXT DEFAULT 'initial_outreach',
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_sales_company_intelligence_company_id ON public.sales_company_intelligence(company_id);
CREATE INDEX idx_sales_company_intelligence_profile_id ON public.sales_company_intelligence(profile_id);
CREATE INDEX idx_jericho_action_log_profile_id ON public.jericho_action_log(profile_id);
CREATE INDEX idx_jericho_action_log_entity_id ON public.jericho_action_log(entity_id);
CREATE INDEX idx_jericho_action_log_can_undo ON public.jericho_action_log(can_undo) WHERE can_undo = true;
CREATE INDEX idx_email_drafts_profile_id ON public.email_drafts(profile_id);
CREATE INDEX idx_email_drafts_sales_company_id ON public.email_drafts(sales_company_id);

-- Create updated_at trigger for sales_company_intelligence
CREATE TRIGGER update_sales_company_intelligence_updated_at
    BEFORE UPDATE ON public.sales_company_intelligence
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE public.sales_company_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jericho_action_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sales_company_intelligence
CREATE POLICY "Users can view own intelligence records"
    ON public.sales_company_intelligence FOR SELECT
    USING (profile_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can create own intelligence records"
    ON public.sales_company_intelligence FOR INSERT
    WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update own intelligence records"
    ON public.sales_company_intelligence FOR UPDATE
    USING (profile_id = auth.uid() OR public.is_super_admin(auth.uid()))
    WITH CHECK (profile_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can delete own intelligence records"
    ON public.sales_company_intelligence FOR DELETE
    USING (profile_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- RLS Policies for jericho_action_log
CREATE POLICY "Users can view own action logs"
    ON public.jericho_action_log FOR SELECT
    USING (profile_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can create own action logs"
    ON public.jericho_action_log FOR INSERT
    WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update own action logs"
    ON public.jericho_action_log FOR UPDATE
    USING (profile_id = auth.uid() OR public.is_super_admin(auth.uid()))
    WITH CHECK (profile_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- RLS Policies for email_drafts
CREATE POLICY "Users can view own email drafts"
    ON public.email_drafts FOR SELECT
    USING (profile_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can create own email drafts"
    ON public.email_drafts FOR INSERT
    WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update own email drafts"
    ON public.email_drafts FOR UPDATE
    USING (profile_id = auth.uid() OR public.is_super_admin(auth.uid()))
    WITH CHECK (profile_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can delete own email drafts"
    ON public.email_drafts FOR DELETE
    USING (profile_id = auth.uid() OR public.is_super_admin(auth.uid()));