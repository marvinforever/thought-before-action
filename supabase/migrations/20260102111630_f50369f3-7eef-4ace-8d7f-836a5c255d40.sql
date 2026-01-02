-- Create a table for development ideas/requests
CREATE TABLE public.development_ideas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'feature',
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'idea',
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.development_ideas ENABLE ROW LEVEL SECURITY;

-- Only super admins can view/manage development ideas
CREATE POLICY "Super admins can view development ideas"
  ON public.development_ideas
  FOR SELECT
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can create development ideas"
  ON public.development_ideas
  FOR INSERT
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update development ideas"
  ON public.development_ideas
  FOR UPDATE
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete development ideas"
  ON public.development_ideas
  FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_development_ideas_updated_at
  BEFORE UPDATE ON public.development_ideas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();