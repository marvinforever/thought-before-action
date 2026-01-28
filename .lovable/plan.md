
# Filter Sales Manager Dashboard to Salespeople Only

## Problem
The Pipeline Health and other charts currently show **all employees** in a company, including non-sales staff (accounting, operations, etc.). Only users with actual sales activity should appear.

## Solution
Use activity-based filtering in the edge function to only return users who have records in sales-related tables.

---

## Implementation Details

### Edge Function Changes (`get-sales-team-report/index.ts`)

Currently, when a super admin views a company, the function fetches all users:
```typescript
const { data: companyUsers } = await supabase
  .from("profiles")
  .select("id, full_name")
  .eq("company_id", viewAsCompanyId);
```

We will change this to query users who have activity in any of these tables:
- `call_plan_tracking` (4-Call activity)
- `sales_deals` (Pipeline deals)
- `sales_coach_conversations` (AI coaching sessions)

### Query Strategy

Instead of getting all company users first, we will:

1. Query distinct `profile_id` values from the three sales tables, filtered by users in the target company
2. Combine into a unique set of "salespeople"
3. Only return data for those salespeople

### Modified Logic Flow

```text
1. Get target company ID (existing logic)
2. Query distinct profile_ids who have sales activity:
   - UNION of profile_ids from call_plan_tracking, sales_deals, sales_coach_conversations
   - Joined with profiles to filter by company_id
3. Use this filtered list as directReportIds
4. Proceed with existing aggregation logic
```

### SQL Approach (executed via Supabase client)

```sql
-- Get all profile_ids with sales activity in target company
SELECT DISTINCT p.id, p.full_name
FROM profiles p
WHERE p.company_id = $targetCompanyId
AND (
  EXISTS (SELECT 1 FROM call_plan_tracking cpt WHERE cpt.profile_id = p.id)
  OR EXISTS (SELECT 1 FROM sales_deals sd WHERE sd.profile_id = p.id)
  OR EXISTS (SELECT 1 FROM sales_coach_conversations scc WHERE scc.profile_id = p.id)
)
```

This approach:
- Returns only users with at least one sales activity record
- Preserves the existing data aggregation logic
- Works for both super admin "View As" and regular manager queries

---

## Changes Required

### File: `supabase/functions/get-sales-team-report/index.ts`

1. Add a helper function to get salespeople by activity:
   ```typescript
   async function getSalespeopleByActivity(
     supabase: any, 
     companyId: string
   ): Promise<{ id: string; full_name: string }[]>
   ```

2. Modify the super admin company view logic (around line 117-129) to:
   - Instead of fetching all company users
   - Fetch only users with sales activity using the new helper

3. For managers viewing direct reports:
   - Keep existing `manager_assignments` logic
   - Optionally filter to only show reports with sales activity

### File: `src/components/sales/PipelineHealthChart.tsx`

- No changes needed - will automatically show only salespeople once backend filters correctly

### File: `src/components/sales/SalesManagerDashboard.tsx`

- No changes needed

---

## Affected Users

| Scenario | Before | After |
|----------|--------|-------|
| Super admin views Stateline | Shows all 27 employees | Shows ~9 with sales activity |
| Manager views their team | Shows all direct reports | Shows only sales-active reports |
| Overview card "Active Sellers" | Counts all with any data | Counts all salespeople (unchanged) |

---

## Testing Approach

1. As super admin, select "Stateline Cooperative" from View As
2. Open Team Dashboard
3. Verify Pipeline tab shows only salespeople (Ben, Blake, Christian, Ed, Joel, Kelli, Trevor, etc.)
4. Verify non-sales employees (Amy, Andrew, Ani, Bill, etc.) are not shown
