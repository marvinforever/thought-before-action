-- Create job_descriptions table to store and track all analyzed job descriptions
CREATE TABLE public.job_descriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  title text,
  description text NOT NULL,
  analysis_results jsonb,
  capabilities_assigned jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  is_current boolean DEFAULT true NOT NULL
);

-- Enable RLS
ALTER TABLE public.job_descriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for job_descriptions
CREATE POLICY "Users can view their own job descriptions"
ON public.job_descriptions
FOR SELECT
USING (profile_id = auth.uid());

CREATE POLICY "Admins can view all job descriptions in their company"
ON public.job_descriptions
FOR SELECT
USING (
  company_id IN (
    SELECT company_id 
    FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = true
  )
);

CREATE POLICY "Admins can insert job descriptions in their company"
ON public.job_descriptions
FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id 
    FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = true
  )
);

CREATE POLICY "Admins can update job descriptions in their company"
ON public.job_descriptions
FOR UPDATE
USING (
  company_id IN (
    SELECT company_id 
    FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER job_descriptions_updated_at
BEFORE UPDATE ON public.job_descriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();