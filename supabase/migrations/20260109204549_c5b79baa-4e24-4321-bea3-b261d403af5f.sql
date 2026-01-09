-- Fix RLS policies for sales_prep_documents (remove references to auth.users)

ALTER TABLE public.sales_prep_documents ENABLE ROW LEVEL SECURITY;

-- Drop broken policies
DROP POLICY IF EXISTS "Users can view their own prep documents" ON public.sales_prep_documents;
DROP POLICY IF EXISTS "Users can create their own prep documents" ON public.sales_prep_documents;
DROP POLICY IF EXISTS "Users can update their own prep documents" ON public.sales_prep_documents;
DROP POLICY IF EXISTS "Users can delete their own prep documents" ON public.sales_prep_documents;
DROP POLICY IF EXISTS "Anyone can view public prep documents" ON public.sales_prep_documents;

-- Recreate policies using auth.uid() directly (profiles.id == auth user id)
CREATE POLICY "Users can view their own prep documents"
ON public.sales_prep_documents
FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

CREATE POLICY "Users can create their own prep documents"
ON public.sales_prep_documents
FOR INSERT
TO authenticated
WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update their own prep documents"
ON public.sales_prep_documents
FOR UPDATE
TO authenticated
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can delete their own prep documents"
ON public.sales_prep_documents
FOR DELETE
TO authenticated
USING (profile_id = auth.uid());

-- Public read-only access for shared documents
CREATE POLICY "Anyone can view public prep documents"
ON public.sales_prep_documents
FOR SELECT
TO anon, authenticated
USING (is_public = true);
