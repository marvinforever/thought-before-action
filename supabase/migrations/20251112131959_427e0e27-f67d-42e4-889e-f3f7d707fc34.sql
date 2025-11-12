-- Allow employees to be assigned to multiple managers
-- 1) Drop the unique constraint that forced a single manager per employee
ALTER TABLE public.manager_assignments
DROP CONSTRAINT IF EXISTS manager_assignments_employee_id_key;

-- 2) Ensure duplicates of the same (manager, employee) pair are prevented
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'manager_assignments_unique_manager_employee'
  ) THEN
    ALTER TABLE public.manager_assignments
    ADD CONSTRAINT manager_assignments_unique_manager_employee UNIQUE (manager_id, employee_id);
  END IF;
END $$;
