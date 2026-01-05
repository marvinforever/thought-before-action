
-- Allow users to insert their own 'partner' role (for self-registration)
CREATE POLICY "Users can add partner role to themselves"
ON public.user_roles
FOR INSERT
WITH CHECK (
  user_id = auth.uid() 
  AND role = 'partner'::app_role
);
