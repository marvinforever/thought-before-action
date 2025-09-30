-- Add is_active column to profiles table to track suspended employees
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

-- Drop existing update/delete policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Admins can update profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles in their company" ON public.profiles;

-- Create new policies for admin update and delete
CREATE POLICY "Admins can update profiles in their company"
ON public.profiles
FOR UPDATE
USING (
  company_id IN (
    SELECT company_id 
    FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = true
  )
);

CREATE POLICY "Admins can delete profiles in their company"
ON public.profiles
FOR DELETE
USING (
  company_id IN (
    SELECT company_id 
    FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = true
  )
);