-- Create capability_domains table
CREATE TABLE public.capability_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create capability_domain_mappings table (many-to-many)
CREATE TABLE public.capability_domain_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  capability_id UUID NOT NULL REFERENCES public.capabilities(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES public.capability_domains(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(capability_id, domain_id)
);

-- Enable RLS
ALTER TABLE public.capability_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_domain_mappings ENABLE ROW LEVEL SECURITY;

-- RLS policies for capability_domains
CREATE POLICY "Anyone can view capability domains"
ON public.capability_domains FOR SELECT
USING (true);

CREATE POLICY "Admins can manage capability domains"
ON public.capability_domains FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.is_admin = true OR profiles.is_super_admin = true)
  )
);

-- RLS policies for capability_domain_mappings
CREATE POLICY "Anyone can view domain mappings"
ON public.capability_domain_mappings FOR SELECT
USING (true);

CREATE POLICY "Admins can manage domain mappings"
ON public.capability_domain_mappings FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.is_admin = true OR profiles.is_super_admin = true)
  )
);

-- Create indexes for performance
CREATE INDEX idx_domain_mappings_capability ON public.capability_domain_mappings(capability_id);
CREATE INDEX idx_domain_mappings_domain ON public.capability_domain_mappings(domain_id);

-- Seed the 10 domains
INSERT INTO public.capability_domains (name, description, display_order) VALUES
('Leadership & Management', 'Leading self and others, team development, strategic direction', 1),
('Communication', 'Verbal, written, and stakeholder communication skills', 2),
('Execution', 'Planning, delivery, problem-solving, and process excellence', 3),
('Strategic Thinking & Business Acumen', 'Commercial awareness, strategic analysis, and business understanding', 4),
('Relationships & Influence', 'Interpersonal skills, influence, negotiation, and relationship building', 5),
('Personal Mastery', 'Self-awareness, resilience, and self-leadership', 6),
('Sales & Business Development', 'Sales strategy, execution, and business growth', 7),
('Human Resources', 'Talent acquisition, development, and employee relations', 8),
('Safety & Compliance', 'Workplace safety, regulatory compliance, and risk management', 9),
('Agriculture & Technical', 'Industry-specific agronomy, precision ag, feed operations, and technical skills', 10);