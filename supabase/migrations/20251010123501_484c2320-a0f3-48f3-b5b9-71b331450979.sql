-- Ensure RLS is enabled on manager_assignments
ALTER TABLE public.manager_assignments ENABLE ROW LEVEL SECURITY;

-- Conditionally create policies for managers to manage their own assignments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'manager_assignments' 
      AND policyname = 'Managers can insert their own assignments'
  ) THEN
    CREATE POLICY "Managers can insert their own assignments"
    ON public.manager_assignments
    FOR INSERT
    WITH CHECK (
      manager_id = auth.uid()
      AND company_id IN (
        SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'manager_assignments' 
      AND policyname = 'Managers can delete their own assignments'
  ) THEN
    CREATE POLICY "Managers can delete their own assignments"
    ON public.manager_assignments
    FOR DELETE
    USING (
      manager_id = auth.uid()
      AND company_id IN (
        SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'manager_assignments' 
      AND policyname = 'Managers can update their own assignments'
  ) THEN
    CREATE POLICY "Managers can update their own assignments"
    ON public.manager_assignments
    FOR UPDATE
    USING (
      manager_id = auth.uid()
      AND company_id IN (
        SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
      )
    )
    WITH CHECK (
      manager_id = auth.uid()
      AND company_id IN (
        SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
      )
    );
  END IF;
END$$;