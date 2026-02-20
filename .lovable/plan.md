
## Performance Fix: Sales Coach 30+ Second Response Times

### Problem Diagnosis

There are two distinct performance problems happening simultaneously:

**Problem 1 — Pareto & Rep List queries (analytics.ts):**
The `handleParetoAnalysis` and `handleRepCustomerListQuery` handlers use paginated `while` loops that repeatedly query the database in batches of 1,000 rows until all data is exhausted. For Stateline Cooperative's 24,819 records, this means ~25 sequential database round trips, pulling all data into edge function memory before doing in-memory aggregation. This is the worst offender.

**Problem 2 — Per-message context gathering (index.ts, lines 456-492):**
Every single message that mentions a customer name triggers a `.limit(500)` query on `customer_purchase_history`, loading 500 raw rows into the edge function just to build a text summary. This adds unnecessary latency to every customer-focused conversation.

---

### Solution

Replace all raw data fetching with database-side aggregation using two targeted database functions, then use those functions everywhere data is currently fetched in bulk.

#### Step 1 — Create two database RPC functions

**`get_rep_customer_summary(p_company_id, p_rep_first_name)`**
Aggregates all of a rep's customer data entirely in PostgreSQL and returns a pre-sorted summary table (customer name, total revenue, transaction count). No more 24K row transfers.

```sql
CREATE OR REPLACE FUNCTION public.get_rep_customer_summary(
  p_company_id UUID,
  p_rep_first_name TEXT
)
RETURNS TABLE(
  customer_name TEXT,
  total_revenue NUMERIC,
  transaction_count BIGINT,
  rep_name TEXT
)
LANGUAGE sql SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT
    customer_name::TEXT,
    SUM(amount)::NUMERIC AS total_revenue,
    COUNT(*)::BIGINT AS transaction_count,
    MAX(rep_name)::TEXT AS rep_name
  FROM customer_purchase_history
  WHERE company_id = p_company_id
    AND rep_name ILIKE (p_rep_first_name || '%')
  GROUP BY customer_name
  ORDER BY total_revenue DESC;
$$;
```

**`get_customer_purchase_summary_v2(p_company_id, p_customer_name_pattern)`**
Returns a pre-aggregated summary for a specific customer (yearly totals, top products, total revenue). Used in `gatherContext` instead of fetching 500 raw rows.

```sql
CREATE OR REPLACE FUNCTION public.get_customer_purchase_summary_v2(
  p_company_id UUID,
  p_customer_name_pattern TEXT
)
RETURNS TABLE(
  total_revenue NUMERIC,
  transaction_count BIGINT,
  yearly_totals JSONB,
  top_products JSONB,
  last_sale_date DATE
)
LANGUAGE sql SECURITY DEFINER SET search_path = 'public'
AS $$
  WITH base AS (
    SELECT
      COALESCE(year::text, LEFT(sale_date::text, 4)) AS yr,
      amount,
      product_description,
      sale_date
    FROM customer_purchase_history
    WHERE company_id = p_company_id
      AND customer_name ILIKE p_customer_name_pattern
  )
  SELECT
    SUM(amount)::NUMERIC AS total_revenue,
    COUNT(*)::BIGINT AS transaction_count,
    (
      SELECT jsonb_object_agg(yr2, total)
      FROM (
        SELECT yr AS yr2, SUM(amount) AS total FROM base GROUP BY yr ORDER BY yr DESC LIMIT 7
      ) t
    ) AS yearly_totals,
    (
      SELECT jsonb_agg(row_to_json(p))
      FROM (
        SELECT product_description AS name, SUM(amount) AS revenue, COUNT(*) AS txn_count
        FROM base GROUP BY product_description ORDER BY SUM(amount) DESC LIMIT 10
      ) p
    ) AS top_products,
    MAX(sale_date)::DATE AS last_sale_date
  FROM base;
$$;
```

#### Step 2 — Refactor `analytics.ts` (Pareto & Rep List handlers)

**`handleRepCustomerListQuery`**: Replace the paginated `while` loop with a single call to `get_rep_customer_summary` RPC. The aggregation happens in the database. No more 24K row transfers.

**`handleParetoAnalysis`**: Replace the paginated `while` loop with a call to `get_rep_customer_summary` (same RPC works — we just apply the cumulative revenue logic to the pre-aggregated results).

#### Step 3 — Refactor `gatherContext` in `index.ts`

Replace lines 456-492 (the raw 500-row `customer_purchase_history` query) with a call to `get_customer_purchase_summary_v2`. The edge function receives a compact JSON object instead of 500 row objects:

```typescript
// BEFORE (fetches 500 raw rows):
client.from("customer_purchase_history")
  .select("customer_name, year, season, amount, product_description, quantity, sale_date, rep_name")
  .eq("company_id", companyId)
  .or(`customer_name.ilike.%${lastName}%,customer_name.ilike.%${firstName}%`)
  .order("sale_date", { ascending: false })
  .limit(500)

// AFTER (returns 1 pre-aggregated row):
client.rpc("get_customer_purchase_summary_v2", {
  p_company_id: companyId,
  p_customer_name_pattern: `%${lastName}%`
})
```

The resulting `purchaseHistorySummary` string is built the same way — just from the aggregated data instead of raw rows. The `context.purchaseHistory` raw array is **removed entirely** (it was never used by the AI prompt anyway — only the summary text was injected).

---

### Files to Change

| File | Change |
|------|--------|
| Database migration | Add `get_rep_customer_summary` and `get_customer_purchase_summary_v2` RPC functions |
| `supabase/functions/sales-coach/analytics.ts` | Replace `while` pagination loops with single RPC calls |
| `supabase/functions/sales-coach/index.ts` | Replace 500-row raw query in `gatherContext` with RPC call; remove unused `context.purchaseHistory` raw array |

### Expected Impact

| Query Type | Before | After |
|------------|--------|-------|
| "Show Ed's customer list" | 25 DB round trips + 24K rows in memory | 1 DB round trip, 0 raw rows |
| Any customer-focused message | 500 raw rows fetched | 1 pre-aggregated row |
| Pareto analysis | 25 DB round trips + 24K rows | 1 DB round trip |
| General messages (no customer) | No change | No change |

Response time target: Under 5 seconds for all query types.
