-- Remove cross-company manager assignments for Mark Jewell
-- Only keep direct reports from The Momentum Company
DELETE FROM manager_assignments
WHERE manager_id = '426a334a-e1b5-41e8-a4ee-6d3e973f5b49'
  AND employee_id IN (
    SELECT p.id FROM profiles p 
    WHERE p.company_id != '00000000-0000-0000-0000-000000000001'
  );