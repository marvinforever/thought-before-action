-- Allow managers to view all profiles in their company
CREATE POLICY "Managers can view profiles in their company"
ON public.profiles
FOR SELECT
USING (
  company_id IN (
    SELECT p.company_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('manager', 'admin', 'super_admin')
      )
  )
);

-- Allow managers to view diagnostic responses for employees in their company
CREATE POLICY "Managers can view diagnostics in their company"
ON public.diagnostic_responses
FOR SELECT
USING (
  company_id IN (
    SELECT p.company_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('manager', 'admin', 'super_admin')
      )
  )
);