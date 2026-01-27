
# Pareto Revenue Analysis & Unrestricted Historical Data Access

## Understanding Your Request

You want two things:

1. **No restrictions on historical data** - Jericho must see ALL customers and their complete purchase history for sales planning
2. **Pareto analysis** - "Show me which customers make up 80% of my total revenue" (then tell you what % of total customers that represents)

Example: If 80% of your $328M revenue ($262M) comes from just 210 of your 1,046 customers, that's 20% of your customer base generating 80% of your revenue.

---

## Current Limitations

| What | Current State | Problem |
|------|---------------|---------|
| Historical data for AI context | 2,000 rows, top 50 customers | Misses 996 customers |
| Direct history lookup | Unlimited (pages through all) | Works correctly |
| Pareto analysis | Does not exist | Cannot answer "who makes up 80% of revenue" |

---

## Solution

### Part 1: New Pareto Analysis Command

Add a direct data handler (like the purchase history lookup) that:
1. Detects phrases like "top 80%", "make up 80%", "80/20", "pareto", "my biggest customers"
2. Fetches ALL transactions for the user's company (using pagination)
3. Aggregates revenue by customer
4. Sorts customers highest to lowest
5. Walks down the list, accumulating revenue until hitting the requested threshold (e.g., 80%)
6. Returns those customers and calculates what % of total customers they represent

**Example Response:**
```
YOUR TOP REVENUE CUSTOMERS (80% of $2.4M)

These 17 customers generate 80% of your total revenue.
That's only 21% of your 81 total customers.

| Customer          | Revenue     | % of Total |
|-------------------|-------------|------------|
| JOHNSON, TIM      | $182,450    | 7.6%       |
| SMITH BROS        | $156,200    | 6.5%       |
| MURRAY, SCOTT     | $134,800    | 5.6%       |
... (all 17 customers listed)

💡 The Pareto Principle in action: 21% of your customers 
drive 80% of your business.
```

### Part 2: Remove AI Context Restrictions

For the general AI context (when NOT doing a direct lookup), increase visibility:
- Increase transaction fetch from 2,000 to unlimited (paginated)
- Show all customers in aggregated summary, not just top 50
- This ensures Jericho knows about every customer relationship

---

## Technical Implementation

### File: `supabase/functions/sales-coach/index.ts`

**1. Add Pareto Detection (near line 441)**

Detect patterns like:
- "customers that make up 80%"
- "who represents 80% of my revenue"
- "pareto" or "80/20"
- "which customers are 80% of my business"

**2. Create `fetchParetoAnalysis` Function**

```text
function fetchParetoAnalysis({
  supabase, companyId, repName, thresholdPercent = 80
})

Steps:
1. Page through ALL customer_purchase_history rows (same pagination pattern as fetchAllPurchaseHistory)
2. Aggregate: customerTotals[customer_name] += amount
3. Sort by revenue descending
4. Walk through, accumulating until cumulative >= threshold%
5. Return:
   - Customers in the threshold group
   - Total revenue for company/rep
   - Count stats (X of Y customers = Z%)
```

**3. Format Response**

Clean markdown table with:
- Customer name
- Revenue
- Percentage of total
- Summary insight (e.g., "17 customers (21%) generate 80% of your revenue")

**4. Expand Historical Context for AI**

For the general chat context (when not doing a direct lookup):
- Remove the 2,000 row limit on historical data fetch
- Aggregate ALL customers, show more in the context
- The AI will have complete visibility for planning conversations

---

## Data Flow

```text
User: "Which customers make up 80% of my revenue?"
                    |
                    v
     ┌─────────────────────────────────┐
     │ Detect "make up X%" pattern     │
     │ Extract threshold (80)          │
     └─────────────────────────────────┘
                    |
                    v
     ┌─────────────────────────────────┐
     │ fetchParetoAnalysis()           │
     │ - Page through ALL transactions │
     │ - Aggregate by customer_name    │
     │ - Sort by revenue DESC          │
     │ - Find cumulative 80% cutoff    │
     └─────────────────────────────────┘
                    |
                    v
     ┌─────────────────────────────────┐
     │ Format Response:                │
     │ - List all qualifying customers │
     │ - Show revenue & percentage     │
     │ - Calculate customer count %    │
     │ - Add Pareto insight            │
     └─────────────────────────────────┘
```

---

## Variations Supported

| User Says | What Happens |
|-----------|--------------|
| "Which customers make up 80% of my revenue?" | Lists customers comprising 80% of revenue |
| "Show me my top 20% revenue customers" | Lists customers in top 20% of revenue (different question!) |
| "Who are my biggest customers?" | Shows Pareto analysis defaulting to 80% threshold |
| "Pareto analysis" or "80/20 rule" | Same as 80% threshold |
| "Which customers are 90% of my business?" | Uses 90% threshold |
| "Top 80% customers from last year" | Filters to 2024 season |

---

## Why Direct Data Lookup (No LLM)

Same pattern used for purchase history:
- **Speed**: No waiting for AI to process
- **Accuracy**: No hallucination risk
- **Completeness**: Every customer is included
- **Precision**: Exact dollar amounts, not approximations

---

## Summary

| Change | Impact |
|--------|--------|
| New Pareto detection pattern | Understands "make up 80%" requests |
| New `fetchParetoAnalysis` function | Calculates threshold customers |
| Remove row limits on history context | Jericho sees ALL customers |
| Direct response (bypass LLM) | Fast, accurate, complete |
