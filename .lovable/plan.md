

## Problem

When asking "Who are the top 10 customers by revenue from 2025?", Jericho returns ALL customers with all-time (historical) revenue instead of just 10 customers filtered to 2025.

**Root cause:** The year-filtered query in `analytics.ts` references a column called `total_amount` -- but that column does not exist in the `customer_purchase_history` table. The actual column is `amount`. This causes the database query to fail with a 400 error, the deterministic handler returns `null`, and the request falls through to the LLM. The LLM then answers using the `repDataSummary` context (which contains all-time data for the top 20 customers), producing inaccurate results.

## Fix

**File:** `supabase/functions/sales-coach/analytics.ts`

Change the year-filtered query (around line 200) from:

```typescript
.select("customer_name, total_amount")
```

to:

```typescript
.select("customer_name, amount")
```

And the aggregation loop (around line 216) from:

```typescript
const amt = Number(row.total_amount) || 0;
```

to:

```typescript
const amt = Number(row.amount) || 0;
```

This is a 2-line fix. Once corrected, the deterministic Pareto handler will successfully query 2025 purchase data, aggregate by customer, sort by revenue, slice to the requested top N, and return a formatted markdown table -- bypassing the LLM entirely for this type of query.

