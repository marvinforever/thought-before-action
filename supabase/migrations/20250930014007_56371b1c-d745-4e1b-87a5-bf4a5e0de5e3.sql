-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE learning_preference AS ENUM ('visual', 'reading', 'hands_on', 'auditory', 'mixed');
CREATE TYPE content_type AS ENUM ('article', 'video', 'podcast', 'book', 'course', 'tool', 'template');
CREATE TYPE capability_level AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');
CREATE TYPE workload_status AS ENUM ('very_manageable', 'manageable', 'stretched', 'overwhelmed', 'unsustainable');
CREATE TYPE burnout_level AS ENUM ('energized', 'normal', 'tired', 'drained', 'burned_out');
CREATE TYPE engagement_level AS ENUM ('very_engaged', 'engaged', 'neutral', 'disengaged', 'very_disengaged');

-- Companies table (multi-tenant)
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  role TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Capabilities framework
CREATE TABLE public.capabilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- e.g., 'leadership', 'technical', 'communication'
  level capability_level DEFAULT 'beginner',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Resources/Content library
CREATE TABLE public.resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  content_type content_type NOT NULL,
  capability_id UUID REFERENCES public.capabilities(id) ON DELETE SET NULL,
  capability_level capability_level,
  estimated_time_minutes INTEGER, -- How long to consume
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Diagnostic responses (raw survey data)
CREATE TABLE public.diagnostic_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Role clarity
  role_clarity_score INTEGER, -- 1-10
  has_written_job_description BOOLEAN,
  most_important_job_aspect TEXT,
  confidence_score INTEGER, -- 1-10
  natural_strength TEXT,
  biggest_difficulty TEXT,
  skill_to_master TEXT,
  
  -- Workload & burnout
  workload_status workload_status,
  mental_drain_frequency TEXT,
  focus_quality TEXT,
  work_life_sacrifice_frequency TEXT,
  energy_drain_area TEXT,
  burnout_frequency TEXT,
  
  -- Learning preferences
  learning_preference learning_preference,
  weekly_development_hours DECIMAL,
  learning_motivation TEXT,
  needed_training TEXT,
  growth_barrier TEXT,
  listens_to_podcasts BOOLEAN,
  watches_youtube BOOLEAN,
  reads_books_articles BOOLEAN,
  
  -- Engagement & retention
  sees_growth_path BOOLEAN,
  manager_support_quality TEXT,
  feels_valued BOOLEAN,
  daily_energy_level TEXT,
  would_stay_if_offered_similar TEXT,
  retention_improvement_suggestion TEXT,
  sees_leadership_path BOOLEAN,
  three_year_goal TEXT,
  company_supporting_goal BOOLEAN,
  
  -- Workplace experience
  biggest_work_obstacle TEXT,
  biggest_frustration TEXT,
  why_people_leave_opinion TEXT,
  what_enjoy_most TEXT,
  leadership_should_understand TEXT,
  additional_feedback TEXT,
  
  -- Recent performance
  recent_accomplishment TEXT,
  recent_challenge TEXT,
  needed_training_for_effectiveness TEXT,
  twelve_month_growth_goal TEXT,
  support_needed_from_leadership TEXT,
  one_year_vision TEXT,
  
  -- Metadata
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employee capabilities (AI-assigned)
CREATE TABLE public.employee_capabilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  capability_id UUID REFERENCES public.capabilities(id) ON DELETE CASCADE,
  current_level capability_level,
  target_level capability_level,
  priority INTEGER, -- 1-5, higher = more urgent
  ai_reasoning TEXT, -- Why this was assigned
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(profile_id, capability_id)
);

-- Content recommendations
CREATE TABLE public.content_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  resource_id UUID REFERENCES public.resources(id) ON DELETE CASCADE,
  employee_capability_id UUID REFERENCES public.employee_capabilities(id) ON DELETE CASCADE,
  match_score DECIMAL, -- 0-1, how well this matches their needs
  ai_reasoning TEXT, -- Why this was recommended
  status TEXT DEFAULT 'pending', -- pending, sent, clicked, completed
  sent_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email deliveries
CREATE TABLE public.email_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  subject TEXT,
  body TEXT,
  resources_included JSONB, -- Array of resource IDs
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  opened_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'sent' -- sent, opened, failed
);

-- Enable Row Level Security
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_deliveries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for multi-tenant isolation

-- Companies: Users can only see their own company
CREATE POLICY "Users can view their own company"
  ON public.companies FOR SELECT
  USING (id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  ));

-- Profiles: Users can view profiles in their company
CREATE POLICY "Users can view profiles in their company"
  ON public.profiles FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- Capabilities: Public read (everyone can see capability framework)
CREATE POLICY "Anyone can view capabilities"
  ON public.capabilities FOR SELECT
  USING (true);

-- Resources: Company-scoped
CREATE POLICY "Users can view resources in their company"
  ON public.resources FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage resources"
  ON public.resources FOR ALL
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ));

-- Diagnostic responses: Users can only see their own, admins can see all in company
CREATE POLICY "Users can view their own diagnostic responses"
  ON public.diagnostic_responses FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Admins can view all diagnostic responses in their company"
  ON public.diagnostic_responses FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ));

CREATE POLICY "Users can insert their own diagnostic responses"
  ON public.diagnostic_responses FOR INSERT
  WITH CHECK (profile_id = auth.uid());

-- Employee capabilities: Users see their own, admins see all in company
CREATE POLICY "Users can view their own capabilities"
  ON public.employee_capabilities FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Admins can view all employee capabilities in their company"
  ON public.employee_capabilities FOR SELECT
  USING (profile_id IN (
    SELECT id FROM public.profiles 
    WHERE company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    )
  ));

CREATE POLICY "Admins can manage employee capabilities"
  ON public.employee_capabilities FOR ALL
  USING (profile_id IN (
    SELECT id FROM public.profiles 
    WHERE company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    )
  ));

-- Content recommendations: Users see their own, admins see all in company
CREATE POLICY "Users can view their own recommendations"
  ON public.content_recommendations FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Admins can view all recommendations in their company"
  ON public.content_recommendations FOR SELECT
  USING (profile_id IN (
    SELECT id FROM public.profiles 
    WHERE company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    )
  ));

CREATE POLICY "Admins can manage recommendations"
  ON public.content_recommendations FOR ALL
  USING (profile_id IN (
    SELECT id FROM public.profiles 
    WHERE company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    )
  ));

-- Email deliveries: Users see their own, admins see all in company
CREATE POLICY "Users can view their own email deliveries"
  ON public.email_deliveries FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Admins can view all email deliveries in their company"
  ON public.email_deliveries FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ));

-- Indexes for performance
CREATE INDEX idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX idx_resources_company_id ON public.resources(company_id);
CREATE INDEX idx_resources_capability_id ON public.resources(capability_id);
CREATE INDEX idx_diagnostic_responses_profile_id ON public.diagnostic_responses(profile_id);
CREATE INDEX idx_diagnostic_responses_company_id ON public.diagnostic_responses(company_id);
CREATE INDEX idx_employee_capabilities_profile_id ON public.employee_capabilities(profile_id);
CREATE INDEX idx_content_recommendations_profile_id ON public.content_recommendations(profile_id);
CREATE INDEX idx_email_deliveries_profile_id ON public.email_deliveries(profile_id);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employee_capabilities_updated_at BEFORE UPDATE ON public.employee_capabilities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();