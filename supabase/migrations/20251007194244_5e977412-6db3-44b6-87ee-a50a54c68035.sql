-- Add policy for super_admins to view all interest indicators
CREATE POLICY "Super admins can view all interest indicators"
ON public.roadmap_interest_indicators
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_super_admin = true
  )
);