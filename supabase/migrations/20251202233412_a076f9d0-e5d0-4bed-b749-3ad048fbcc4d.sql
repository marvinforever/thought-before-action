-- Allow super admins to manage resources
CREATE POLICY "Super admins can manage resources" 
ON public.resources 
FOR ALL 
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));