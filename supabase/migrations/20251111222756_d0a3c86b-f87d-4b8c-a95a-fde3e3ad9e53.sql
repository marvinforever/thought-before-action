-- Fix privilege escalation vulnerability: Prevent users from promoting themselves to admin
-- Drop the existing unsafe update policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create a new policy that allows users to update their profile 
-- BUT prevents them from changing admin flags
CREATE POLICY "Users can update their own profile (except admin flags)"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid() 
    AND
    -- Prevent users from modifying is_admin flag
    is_admin = (SELECT is_admin FROM public.profiles WHERE id = auth.uid())
    AND
    -- Prevent users from modifying is_super_admin flag
    is_super_admin = (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid())
  );

-- Add a comment explaining the security constraint
COMMENT ON POLICY "Users can update their own profile (except admin flags)" ON public.profiles IS 
  'Allows users to update their own profile data (name, email, phone, etc.) but prevents them from changing is_admin or is_super_admin flags to prevent privilege escalation attacks.';