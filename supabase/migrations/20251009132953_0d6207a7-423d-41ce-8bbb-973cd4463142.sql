-- Add policy to allow super admins to insert diagnostic responses for any user
CREATE POLICY "Super admins can insert diagnostic responses for any user"
ON public.diagnostic_responses
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_super_admin = true
  )
);