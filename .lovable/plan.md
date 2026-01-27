
## Goal
Fix the 4‑Call Tracker so:
1) The revenue line **beneath each customer name** shows **2025** (not “lifetime”) and no longer appears as “$ $261…”.
2) The **seller totals up top** show **only 2025 revenue** (remove lifetime total entirely, including the lifetime fetch/aggregation).

## What’s happening now (root cause)
- In `CustomerCallCard.tsx`, the row under the customer name uses:
  - a **DollarSign icon** (visually a “$”)
  - plus `formatCurrency(...)` which **also prepends `$`**
  - Result: it can look like “$ $261K …”
- The same row explicitly appends the label **“lifetime”**, even though `customer.total_revenue` being passed in is already **2025-only** revenue from the tracker query.
- In `FourCallPlanTracker.tsx`, we added a second query to compute **lifetimeRevenue** and display it in the top stats line. You now want that removed.

## Implementation changes (no schema changes required)

### 1) Update the customer card “revenue under name” line
**File:** `src/components/sales/CustomerCallCard.tsx`

- Change the label text from `lifetime` to `2025`.
- Remove the `DollarSign` icon (or otherwise ensure only one `$` appears).  
  Recommended: remove the icon and keep `formatCurrency` as-is (because it already formats nicely and consistently across the UI).

**Expected UI result:**
- Under each customer name: “$261K 2025” (or similar), with only one dollar sign.

### 2) Remove lifetime totals from the tracker header (seller totals up top)
**File:** `src/components/sales/FourCallPlanTracker.tsx`

- Remove the lifetime-related state:
  - `const [lifetimeRevenue, setLifetimeRevenue] = useState(0);`
- Remove the lifetime fetch loop and lifetime aggregation:
  - delete the “Also fetch lifetime revenue…” pagination block
  - delete `lifetimeTotal` computation
  - delete `setLifetimeRevenue(lifetimeTotal)`
- Update the header stats UI to show only 2025 revenue:
  - Change the `TrendingUp` row to display only `totalRevenue` and label it “2025”.

**Expected UI result:**
- Top stats line shows: “$XYZK 2025” only (no lifetime figure).

## Verification checklist (what I’ll test after implementing)
1) Open `/sales-trainer` → open the 4‑Call Tracker dialog:
   - Customer line under name reads “$… 2025” and not “lifetime”.
   - No “$ $” duplication.
2) Top summary revenue line:
   - Shows only 2025 total revenue.
3) Refresh button still works and doesn’t error after removing lifetime logic.

## Notes / edge cases
- This does not change any data; it’s purely display and removing an unnecessary lifetime query.
- `customer.total_revenue` in the tracker is already computed from 2025-filtered transactions, so relabeling it to “2025” is correct.
