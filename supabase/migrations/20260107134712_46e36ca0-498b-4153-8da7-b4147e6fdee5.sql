
-- Create enum for deal stages
CREATE TYPE public.deal_stage AS ENUM ('prospecting', 'discovery', 'proposal', 'closing', 'follow_up');

-- Create enum for activity types
CREATE TYPE public.sales_activity_type AS ENUM ('call', 'email', 'meeting', 'note', 'task');

-- Sales Companies (accounts the user is targeting)
CREATE TABLE public.sales_companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  industry TEXT,
  location TEXT,
  website TEXT,
  annual_revenue TEXT,
  employee_count TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sales Contacts (people at those companies)
CREATE TABLE public.sales_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.sales_companies(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  is_decision_maker BOOLEAN DEFAULT false,
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sales Deals (opportunities in the pipeline)
CREATE TABLE public.sales_deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.sales_companies(id) ON DELETE SET NULL,
  primary_contact_id UUID REFERENCES public.sales_contacts(id) ON DELETE SET NULL,
  deal_name TEXT NOT NULL,
  stage public.deal_stage NOT NULL DEFAULT 'prospecting',
  value NUMERIC(12,2),
  expected_close_date DATE,
  priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
  probability INTEGER DEFAULT 10 CHECK (probability >= 0 AND probability <= 100),
  loss_reason TEXT,
  win_notes TEXT,
  notes TEXT,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sales Activities (activity log for deals)
CREATE TABLE public.sales_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.sales_deals(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.sales_contacts(id) ON DELETE SET NULL,
  activity_type public.sales_activity_type NOT NULL,
  subject TEXT,
  notes TEXT,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  outcome TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sales Knowledge Base (training content Jericho can reference)
CREATE TABLE public.sales_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT, -- e.g., 'prospecting', 'discovery', 'objection_handling', 'closing', 'general'
  stage public.deal_stage, -- optional: link to specific stage
  tags TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.sales_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_knowledge ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sales_companies (users see only their own)
CREATE POLICY "Users can view their own sales companies"
  ON public.sales_companies FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can create their own sales companies"
  ON public.sales_companies FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update their own sales companies"
  ON public.sales_companies FOR UPDATE
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own sales companies"
  ON public.sales_companies FOR DELETE
  USING (auth.uid() = profile_id);

-- RLS Policies for sales_contacts
CREATE POLICY "Users can view their own sales contacts"
  ON public.sales_contacts FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can create their own sales contacts"
  ON public.sales_contacts FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update their own sales contacts"
  ON public.sales_contacts FOR UPDATE
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own sales contacts"
  ON public.sales_contacts FOR DELETE
  USING (auth.uid() = profile_id);

-- RLS Policies for sales_deals
CREATE POLICY "Users can view their own deals"
  ON public.sales_deals FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can create their own deals"
  ON public.sales_deals FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update their own deals"
  ON public.sales_deals FOR UPDATE
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own deals"
  ON public.sales_deals FOR DELETE
  USING (auth.uid() = profile_id);

-- RLS Policies for sales_activities
CREATE POLICY "Users can view their own activities"
  ON public.sales_activities FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can create their own activities"
  ON public.sales_activities FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update their own activities"
  ON public.sales_activities FOR UPDATE
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own activities"
  ON public.sales_activities FOR DELETE
  USING (auth.uid() = profile_id);

-- RLS Policies for sales_knowledge (everyone can read, admins can write)
CREATE POLICY "Anyone authenticated can read sales knowledge"
  ON public.sales_knowledge FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

CREATE POLICY "Super admins can manage sales knowledge"
  ON public.sales_knowledge FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_sales_companies_profile ON public.sales_companies(profile_id);
CREATE INDEX idx_sales_contacts_profile ON public.sales_contacts(profile_id);
CREATE INDEX idx_sales_contacts_company ON public.sales_contacts(company_id);
CREATE INDEX idx_sales_deals_profile ON public.sales_deals(profile_id);
CREATE INDEX idx_sales_deals_stage ON public.sales_deals(stage);
CREATE INDEX idx_sales_deals_company ON public.sales_deals(company_id);
CREATE INDEX idx_sales_activities_deal ON public.sales_activities(deal_id);
CREATE INDEX idx_sales_activities_profile ON public.sales_activities(profile_id);
CREATE INDEX idx_sales_knowledge_stage ON public.sales_knowledge(stage);
CREATE INDEX idx_sales_knowledge_category ON public.sales_knowledge(category);

-- Triggers for updated_at
CREATE TRIGGER update_sales_companies_updated_at
  BEFORE UPDATE ON public.sales_companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_contacts_updated_at
  BEFORE UPDATE ON public.sales_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_deals_updated_at
  BEFORE UPDATE ON public.sales_deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_knowledge_updated_at
  BEFORE UPDATE ON public.sales_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update deal's last_activity_at when activity is added
CREATE OR REPLACE FUNCTION public.update_deal_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deal_id IS NOT NULL THEN
    UPDATE public.sales_deals
    SET last_activity_at = NEW.created_at
    WHERE id = NEW.deal_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_deal_activity_timestamp
  AFTER INSERT ON public.sales_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_deal_last_activity();
