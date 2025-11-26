
-- Drop the existing policies
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete user roles" ON public.user_roles;

-- Create updated policies that check both role system and legacy admin flags
CREATE POLICY "Admins can view all user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'super_admin') OR
  public.is_super_admin(auth.uid()) OR
  (SELECT is_admin FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Admins can insert user roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'super_admin') OR
  public.is_super_admin(auth.uid()) OR
  (SELECT is_admin FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Admins can delete user roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'super_admin') OR
  public.is_super_admin(auth.uid()) OR
  (SELECT is_admin FROM public.profiles WHERE id = auth.uid())
);
