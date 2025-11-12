-- Add RLS policies for managers to assign capabilities to their team members

-- Managers can insert capabilities for their direct reports
CREATE POLICY "Managers can assign capabilities to their team"
  ON employee_capabilities FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT employee_id 
      FROM manager_assignments 
      WHERE manager_id = auth.uid()
    )
  );

-- Managers can update capabilities for their direct reports
CREATE POLICY "Managers can update team capabilities"
  ON employee_capabilities FOR UPDATE
  TO authenticated
  USING (
    profile_id IN (
      SELECT employee_id 
      FROM manager_assignments 
      WHERE manager_id = auth.uid()
    )
  );

-- Managers can delete capabilities for their direct reports
CREATE POLICY "Managers can delete team capabilities"
  ON employee_capabilities FOR DELETE
  TO authenticated
  USING (
    profile_id IN (
      SELECT employee_id 
      FROM manager_assignments 
      WHERE manager_id = auth.uid()
    )
  );

-- Managers can view capabilities of their direct reports
CREATE POLICY "Managers can view team capabilities"
  ON employee_capabilities FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT employee_id 
      FROM manager_assignments 
      WHERE manager_id = auth.uid()
    )
  );