-- Add is_global flag to company_knowledge
ALTER TABLE public.company_knowledge 
ADD COLUMN IF NOT EXISTS is_global boolean DEFAULT false;

-- Add index for efficient global content queries
CREATE INDEX IF NOT EXISTS idx_company_knowledge_global 
ON public.company_knowledge(is_global) WHERE is_global = true;

-- Create policy for super admins to manage global content
CREATE POLICY "Super admins can manage global knowledge"
ON public.company_knowledge
FOR ALL
USING (
  public.is_super_admin(auth.uid()) 
  OR (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
)
WITH CHECK (
  -- Only super admins can set is_global = true
  (is_global = false OR public.is_super_admin(auth.uid()))
  AND (
    public.is_super_admin(auth.uid()) 
    OR company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
);

-- Allow all authenticated users to READ global knowledge
CREATE POLICY "All users can read global knowledge"
ON public.company_knowledge
FOR SELECT
USING (
  is_global = true
  OR company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  OR public.is_super_admin(auth.uid())
);