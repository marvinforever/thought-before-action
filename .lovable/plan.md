

# Fix: Pipeline Deal Move Error (RLS Policy Gap)

## Root Cause
The `sales_deals` table has UPDATE and DELETE RLS policies that only check `auth.uid() = profile_id`. The SELECT policy has a super admin override (`OR is_super_admin(auth.uid())`), but UPDATE and DELETE do not. When using "View As" mode (or if `userId` differs from `auth.uid()` for any reason), moves and deletes fail silently.

## Fix

### Step 1: Database Migration — Add super admin override to UPDATE and DELETE policies

```sql
DROP POLICY IF EXISTS "Users can update their own deals" ON sales_deals;
CREATE POLICY "Users can update their own deals" ON sales_deals
  FOR UPDATE USING (auth.uid() = profile_id OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own deals" ON sales_deals;
CREATE POLICY "Users can delete their own deals" ON sales_deals
  FOR DELETE USING (auth.uid() = profile_id OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can create their own deals" ON sales_deals;
CREATE POLICY "Users can create their own deals" ON sales_deals
  FOR INSERT WITH CHECK (auth.uid() = profile_id OR is_super_admin(auth.uid()));
```

This aligns UPDATE/DELETE/INSERT with the existing SELECT policy pattern.

No frontend code changes needed -- the `PipelineView.moveDeal` already correctly passes `profile_id` in the `.eq()` filter.

