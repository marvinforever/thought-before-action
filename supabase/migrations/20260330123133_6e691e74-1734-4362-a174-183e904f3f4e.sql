-- Allow authenticated users to insert sales knowledge for their own company
CREATE POLICY "Users can insert sales knowledge for their company"
ON public.sales_knowledge
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  AND created_by = auth.uid()
);

-- Allow users to update their own sales knowledge
CREATE POLICY "Users can update their own sales knowledge"
ON public.sales_knowledge
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Allow users to delete their own sales knowledge
CREATE POLICY "Users can delete their own sales knowledge"
ON public.sales_knowledge
FOR DELETE
TO authenticated
USING (created_by = auth.uid());