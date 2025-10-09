-- Add policy to allow super admins to manage employee capabilities across all companies
CREATE POLICY "Super admins can manage all employee capabilities"
ON public.employee_capabilities
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = true
  )
);