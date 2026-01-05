-- Fix recognition RLS so anyone in a company can send recognition to anyone in the same company

-- First, drop the existing insert policies that might be restrictive
DROP POLICY IF EXISTS "Users can create recognition" ON recognition_notes;
DROP POLICY IF EXISTS "Users can insert recognition for same company" ON recognition_notes;

-- Create a single clear INSERT policy: users can send recognition to anyone in their company
CREATE POLICY "Users can send recognition to company members"
ON recognition_notes
FOR INSERT
WITH CHECK (
  given_by = auth.uid()
  AND company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  AND given_to IN (SELECT id FROM profiles WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
);

-- Also ensure SELECT covers seeing all company recognitions properly
DROP POLICY IF EXISTS "Users can view recognition given to them" ON recognition_notes;
DROP POLICY IF EXISTS "Users can view relevant recognition" ON recognition_notes;
DROP POLICY IF EXISTS "Team visibility recognition is viewable by company" ON recognition_notes;
DROP POLICY IF EXISTS "Managers can view recognition for their reports" ON recognition_notes;

-- Single clear SELECT policy: users can see all recognition in their company
CREATE POLICY "Users can view company recognition"
ON recognition_notes
FOR SELECT
USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);