-- Create learning_roadmaps table
CREATE TABLE public.learning_roadmaps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  roadmap_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.learning_roadmaps ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own roadmaps"
ON public.learning_roadmaps
FOR SELECT
USING (profile_id = auth.uid());

CREATE POLICY "Users can insert their own roadmaps"
ON public.learning_roadmaps
FOR INSERT
WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update their own roadmaps"
ON public.learning_roadmaps
FOR UPDATE
USING (profile_id = auth.uid());

CREATE POLICY "Admins can view all roadmaps in their company"
ON public.learning_roadmaps
FOR SELECT
USING (
  company_id IN (
    SELECT company_id 
    FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_learning_roadmaps_updated_at
BEFORE UPDATE ON public.learning_roadmaps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better query performance
CREATE INDEX idx_learning_roadmaps_profile_id ON public.learning_roadmaps(profile_id);
CREATE INDEX idx_learning_roadmaps_company_id ON public.learning_roadmaps(company_id);
CREATE INDEX idx_learning_roadmaps_expires_at ON public.learning_roadmaps(expires_at);