-- Allow users to update their own self-assessment data
CREATE POLICY "Users can update their own self-assessments"
ON employee_capabilities
FOR UPDATE
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());