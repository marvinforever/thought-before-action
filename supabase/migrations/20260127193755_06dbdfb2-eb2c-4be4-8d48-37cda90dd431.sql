-- Allow super admins to access call plan tracking for impersonation

-- Ensure RLS is enabled
ALTER TABLE public.call_plan_tracking ENABLE ROW LEVEL SECURITY;

-- SELECT
DROP POLICY IF EXISTS "Users can view own call plan tracking" ON public.call_plan_tracking;
CREATE POLICY "Users can view own call plan tracking"
ON public.call_plan_tracking
FOR SELECT
USING (auth.uid() = profile_id OR public.is_super_admin(auth.uid()));

-- INSERT
DROP POLICY IF EXISTS "Users can insert own call plan tracking" ON public.call_plan_tracking;
CREATE POLICY "Users can insert own call plan tracking"
ON public.call_plan_tracking
FOR INSERT
WITH CHECK (auth.uid() = profile_id OR public.is_super_admin(auth.uid()));

-- UPDATE
DROP POLICY IF EXISTS "Users can update own call plan tracking" ON public.call_plan_tracking;
CREATE POLICY "Users can update own call plan tracking"
ON public.call_plan_tracking
FOR UPDATE
USING (auth.uid() = profile_id OR public.is_super_admin(auth.uid()))
WITH CHECK (auth.uid() = profile_id OR public.is_super_admin(auth.uid()));

-- DELETE
DROP POLICY IF EXISTS "Users can delete own call plan tracking" ON public.call_plan_tracking;
CREATE POLICY "Users can delete own call plan tracking"
ON public.call_plan_tracking
FOR DELETE
USING (auth.uid() = profile_id OR public.is_super_admin(auth.uid()));
