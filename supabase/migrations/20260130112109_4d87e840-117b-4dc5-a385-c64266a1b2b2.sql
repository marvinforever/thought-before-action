-- Drop existing restrictive policies on sales_coach_conversations
DROP POLICY IF EXISTS "Users can create their own sales coach conversations" ON public.sales_coach_conversations;
DROP POLICY IF EXISTS "Users can view their own sales coach conversations" ON public.sales_coach_conversations;
DROP POLICY IF EXISTS "Users can update their own sales coach conversations" ON public.sales_coach_conversations;
DROP POLICY IF EXISTS "Users can delete their own sales coach conversations" ON public.sales_coach_conversations;

-- Create new policies that allow Super Admins to act on behalf of users (View As feature)
CREATE POLICY "Users can create their own sales coach conversations" 
ON public.sales_coach_conversations 
FOR INSERT 
WITH CHECK (auth.uid() = profile_id OR is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own sales coach conversations" 
ON public.sales_coach_conversations 
FOR SELECT 
USING (auth.uid() = profile_id OR is_super_admin(auth.uid()));

CREATE POLICY "Users can update their own sales coach conversations" 
ON public.sales_coach_conversations 
FOR UPDATE 
USING (auth.uid() = profile_id OR is_super_admin(auth.uid()))
WITH CHECK (auth.uid() = profile_id OR is_super_admin(auth.uid()));

CREATE POLICY "Users can delete their own sales coach conversations" 
ON public.sales_coach_conversations 
FOR DELETE 
USING (auth.uid() = profile_id OR is_super_admin(auth.uid()));