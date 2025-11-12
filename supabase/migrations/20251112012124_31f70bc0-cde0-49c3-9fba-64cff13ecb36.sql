-- Restrict access to capabilities framework to protect intellectual property
-- Only allow authenticated users with active company memberships to view

-- Drop existing public read policies
DROP POLICY IF EXISTS "Anyone can view capabilities" ON capabilities;
DROP POLICY IF EXISTS "Anyone can view capability levels" ON capability_levels;
DROP POLICY IF EXISTS "Anyone can view resource capabilities" ON resource_capabilities;

-- Create restricted policies for capabilities table
CREATE POLICY "Company users can view capabilities"
  ON capabilities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.company_id IS NOT NULL
      AND profiles.is_active = true
    )
  );

-- Create restricted policies for capability_levels table
CREATE POLICY "Company users can view capability levels"
  ON capability_levels FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.company_id IS NOT NULL
      AND profiles.is_active = true
    )
  );

-- Create restricted policies for resource_capabilities table
CREATE POLICY "Company users can view resource capabilities"
  ON resource_capabilities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.company_id IS NOT NULL
      AND profiles.is_active = true
    )
  );

-- Keep existing admin management policies intact
-- (These policies for INSERT/UPDATE/DELETE operations remain unchanged)