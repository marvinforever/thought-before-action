-- Enable managers to create company-specific capabilities

-- Add RLS policies for managers to create capabilities
CREATE POLICY "Managers can insert company-specific capabilities"
  ON capabilities FOR INSERT
  TO authenticated
  WITH CHECK (
    is_custom = true 
    AND created_by_company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (
      has_role(auth.uid(), 'manager') 
      OR has_role(auth.uid(), 'admin') 
      OR has_role(auth.uid(), 'super_admin')
    )
  );

CREATE POLICY "Managers can update their company capabilities"
  ON capabilities FOR UPDATE
  TO authenticated
  USING (
    is_custom = true
    AND created_by_company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (
      has_role(auth.uid(), 'manager') 
      OR has_role(auth.uid(), 'admin') 
      OR has_role(auth.uid(), 'super_admin')
    )
  );

CREATE POLICY "Managers can delete their company capabilities"
  ON capabilities FOR DELETE
  TO authenticated
  USING (
    is_custom = true
    AND created_by_company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND (
      has_role(auth.uid(), 'manager') 
      OR has_role(auth.uid(), 'admin') 
      OR has_role(auth.uid(), 'super_admin')
    )
  );

-- Add RLS policies for capability levels
CREATE POLICY "Managers can insert capability levels for their company"
  ON capability_levels FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM capabilities 
      WHERE capabilities.id = capability_id
      AND capabilities.is_custom = true
      AND capabilities.created_by_company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
    AND (
      has_role(auth.uid(), 'manager') 
      OR has_role(auth.uid(), 'admin') 
      OR has_role(auth.uid(), 'super_admin')
    )
  );

CREATE POLICY "Managers can update capability levels for their company"
  ON capability_levels FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM capabilities 
      WHERE capabilities.id = capability_id
      AND capabilities.is_custom = true
      AND capabilities.created_by_company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
    AND (
      has_role(auth.uid(), 'manager') 
      OR has_role(auth.uid(), 'admin') 
      OR has_role(auth.uid(), 'super_admin')
    )
  );

CREATE POLICY "Managers can delete capability levels for their company"
  ON capability_levels FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM capabilities 
      WHERE capabilities.id = capability_id
      AND capabilities.is_custom = true
      AND capabilities.created_by_company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
    AND (
      has_role(auth.uid(), 'manager') 
      OR has_role(auth.uid(), 'admin') 
      OR has_role(auth.uid(), 'super_admin')
    )
  );