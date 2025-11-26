-- Add policy to allow super admins to update any profile
DROP POLICY IF EXISTS "Super admins can update all profiles" ON public.profiles;

CREATE POLICY "Super admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
)
WITH CHECK (
  public.is_super_admin(auth.uid())
);