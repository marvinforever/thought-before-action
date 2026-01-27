-- Drop and recreate the UPDATE policy with proper WITH CHECK clause
DROP POLICY IF EXISTS "Users can update own call plan tracking" ON public.call_plan_tracking;

CREATE POLICY "Users can update own call plan tracking"
ON public.call_plan_tracking
FOR UPDATE
USING (auth.uid() = profile_id)
WITH CHECK (auth.uid() = profile_id);