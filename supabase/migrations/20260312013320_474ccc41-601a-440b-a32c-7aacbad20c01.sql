CREATE POLICY "Coaches can manage own cross-company assignments"
ON public.manager_assignments
FOR ALL
USING (public.has_role(auth.uid(), 'coach') AND manager_id = auth.uid())
WITH CHECK (public.has_role(auth.uid(), 'coach') AND manager_id = auth.uid());