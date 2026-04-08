
-- Add access_level to sales_knowledge
ALTER TABLE public.sales_knowledge
ADD COLUMN IF NOT EXISTS access_level text NOT NULL DEFAULT 'all';

-- Create knowledge_access table
CREATE TABLE public.knowledge_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id uuid NOT NULL REFERENCES public.sales_knowledge(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(knowledge_id, profile_id)
);

ALTER TABLE public.knowledge_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view knowledge access for their company"
ON public.knowledge_access
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sales_knowledge sk
    JOIN public.profiles p ON p.company_id = sk.company_id
    WHERE sk.id = knowledge_access.knowledge_id
    AND p.id = auth.uid()
  )
);

CREATE POLICY "Creators can insert knowledge access"
ON public.knowledge_access
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sales_knowledge sk
    WHERE sk.id = knowledge_access.knowledge_id
    AND sk.created_by = auth.uid()
  )
);

CREATE POLICY "Creators can delete knowledge access"
ON public.knowledge_access
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sales_knowledge sk
    WHERE sk.id = knowledge_access.knowledge_id
    AND sk.created_by = auth.uid()
  )
);
