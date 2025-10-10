-- Fix recursive policy on profiles by replacing it with a function-based condition
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='profiles' AND policyname='Managers can view profiles in their company'
  ) THEN
    DROP POLICY "Managers can view profiles in their company" ON public.profiles;
  END IF;
END$$;

-- Recreate policy using security definer functions to avoid recursion
CREATE POLICY "Managers can view profiles in their company"
ON public.profiles
FOR SELECT
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  )
);
