
DROP POLICY IF EXISTS "Anyone authenticated can read sales knowledge" ON public.sales_knowledge;

CREATE POLICY "Users can read their company sales knowledge"
  ON public.sales_knowledge
  FOR SELECT
  TO authenticated
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );
