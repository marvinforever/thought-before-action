-- Allow authenticated users to insert a company during signup
-- This is needed because the profile doesn't exist yet when creating a company

CREATE POLICY "Authenticated users can create companies during signup" 
ON public.companies 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Note: This allows any authenticated user to create a company.
-- The existing "Super admins can insert companies" policy also exists,
-- but we need this broader policy for the signup flow.