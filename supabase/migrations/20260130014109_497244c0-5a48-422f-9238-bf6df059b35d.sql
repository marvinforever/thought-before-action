-- Create development requests table
CREATE TABLE public.development_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'denied', 'implemented')),
  admin_notes text,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  implemented_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.development_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own requests"
ON public.development_requests
FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

-- Users can create requests
CREATE POLICY "Users can create requests"
ON public.development_requests
FOR INSERT
TO authenticated
WITH CHECK (profile_id = auth.uid());

-- Super admins can view all requests
CREATE POLICY "Super admins can view all requests"
ON public.development_requests
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- Super admins can update requests
CREATE POLICY "Super admins can update requests"
ON public.development_requests
FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- Create updated_at trigger
CREATE TRIGGER update_development_requests_updated_at
BEFORE UPDATE ON public.development_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();