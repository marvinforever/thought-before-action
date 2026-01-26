-- Enable super admin access to sales tables when using View-As

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view their own sales companies" ON public.sales_companies;
DROP POLICY IF EXISTS "Users can view their own sales contacts" ON public.sales_contacts;
DROP POLICY IF EXISTS "Users can view their own sales deals" ON public.sales_deals;
DROP POLICY IF EXISTS "Users can view their own sales activities" ON public.sales_activities;

-- Recreate SELECT policies with super admin access
CREATE POLICY "Users can view their own sales companies or super admin can view all"
  ON public.sales_companies FOR SELECT
  USING (auth.uid() = profile_id OR is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own sales contacts or super admin can view all"
  ON public.sales_contacts FOR SELECT
  USING (auth.uid() = profile_id OR is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own sales deals or super admin can view all"
  ON public.sales_deals FOR SELECT
  USING (auth.uid() = profile_id OR is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own sales activities or super admin can view all"
  ON public.sales_activities FOR SELECT
  USING (auth.uid() = profile_id OR is_super_admin(auth.uid()));