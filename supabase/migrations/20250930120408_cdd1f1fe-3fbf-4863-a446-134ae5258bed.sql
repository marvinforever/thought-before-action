-- Allow company admins to insert diagnostic responses for their company
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'diagnostic_responses' 
      AND policyname = 'Admins can insert diagnostic responses in their company'
  ) THEN
    CREATE POLICY "Admins can insert diagnostic responses in their company"
    ON public.diagnostic_responses
    FOR INSERT
    TO authenticated
    WITH CHECK (
      company_id IN (
        SELECT p.company_id FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_admin = true
      )
    );
  END IF;
END $$;