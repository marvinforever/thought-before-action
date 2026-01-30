-- Fix RLS policy for sales_coach_messages to allow super admins (impersonation support)
DROP POLICY IF EXISTS "Users can create messages in their conversations" ON public.sales_coach_messages;

CREATE POLICY "Users can create messages in their conversations"
ON public.sales_coach_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sales_coach_conversations c
    WHERE c.id = conversation_id 
    AND (
      c.profile_id = auth.uid() 
      OR is_super_admin(auth.uid())
    )
  )
);

-- Also fix SELECT policy for reading messages during impersonation
DROP POLICY IF EXISTS "Users can view messages from their conversations" ON public.sales_coach_messages;

CREATE POLICY "Users can view messages from their conversations"
ON public.sales_coach_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM sales_coach_conversations c
    WHERE c.id = conversation_id 
    AND (
      c.profile_id = auth.uid() 
      OR is_super_admin(auth.uid())
    )
  )
);