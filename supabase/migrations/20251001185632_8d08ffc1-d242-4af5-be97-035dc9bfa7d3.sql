-- Fix failing upsert on employee_capabilities due to missing updated_at column referenced by a trigger
-- 1) Safely drop any triggers on employee_capabilities that call public.update_updated_at_column (which sets NEW.updated_at)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT tg.tgname
    FROM pg_trigger tg
    JOIN pg_class c ON c.oid = tg.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = tg.tgfoid
    WHERE n.nspname = 'public'
      AND c.relname = 'employee_capabilities'
      AND p.proname = 'update_updated_at_column'
  ) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.employee_capabilities;', r.tgname);
  END LOOP;
END $$;

-- 2) Create a dedicated function that updates the correct timestamp column (last_updated)
CREATE OR REPLACE FUNCTION public.update_last_updated_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3) Create a trigger to maintain last_updated on updates to employee_capabilities
DROP TRIGGER IF EXISTS employee_capabilities_last_updated ON public.employee_capabilities;
CREATE TRIGGER employee_capabilities_last_updated
BEFORE UPDATE ON public.employee_capabilities
FOR EACH ROW
EXECUTE FUNCTION public.update_last_updated_column();