-- Align UPDATE/DELETE/INSERT policies with SELECT (add super admin override)
DROP POLICY IF EXISTS "Users can update their own deals" ON sales_deals;
CREATE POLICY "Users can update their own deals" ON sales_deals
  FOR UPDATE USING (auth.uid() = profile_id OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own deals" ON sales_deals;
CREATE POLICY "Users can delete their own deals" ON sales_deals
  FOR DELETE USING (auth.uid() = profile_id OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can create their own deals" ON sales_deals;
CREATE POLICY "Users can create their own deals" ON sales_deals
  FOR INSERT WITH CHECK (auth.uid() = profile_id OR is_super_admin(auth.uid()));