-- Add super admin flag to profiles
ALTER TABLE public.profiles 
ADD COLUMN is_super_admin boolean DEFAULT false;

-- Create index for super admin lookups
CREATE INDEX idx_profiles_super_admin ON public.profiles(is_super_admin) WHERE is_super_admin = true;

-- Function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(is_super_admin, false)
  FROM public.profiles
  WHERE id = _user_id
$$;

-- RLS policy for super admins to view all companies
CREATE POLICY "Super admins can view all companies"
ON public.companies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = true
  )
);

-- RLS policy for super admins to view all profiles
CREATE POLICY "Super admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_super_admin = true
  )
);

-- RLS policy for super admins to view all diagnostic responses
CREATE POLICY "Super admins can view all diagnostic responses"
ON public.diagnostic_responses
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = true
  )
);