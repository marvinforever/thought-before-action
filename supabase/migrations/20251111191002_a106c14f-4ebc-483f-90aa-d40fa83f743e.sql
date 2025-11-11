-- Drop the insecure policy that allows anyone to insert
DROP POLICY IF EXISTS "System can insert risk flags" ON public.employee_risk_flags;

-- Create a secure policy that only allows service role or admins to insert risk flags
CREATE POLICY "Only service role and admins can insert risk flags"
ON public.employee_risk_flags
FOR INSERT
WITH CHECK (
  -- Allow service role (used by edge functions like detect-employee-risks)
  auth.jwt()->>'role' = 'service_role'
  OR
  -- Allow super admins
  has_role(auth.uid(), 'super_admin')
  OR
  -- Allow admins in the same company
  (
    has_role(auth.uid(), 'admin')
    AND company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  )
);