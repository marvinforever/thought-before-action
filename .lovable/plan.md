
# Auto-Link Purchase History to Pipeline Deals

## Overview
When a deal's customer matches someone in the historical purchase data, the system should automatically pull and display their purchase history. This gives reps instant access to buying patterns, product preferences, and revenue data right from the pipeline.

---

## The Matching Challenge

The data exists in two different formats:

| Source | Example Name Format |
|--------|---------------------|
| Pipeline deals (sales_companies) | `Tim Murray`, `Zierke Bros` |
| Purchase history (customer_purchase_history) | `MURRAY, TIM`, `ZIERKE, BRAD` |

The system needs fuzzy matching to connect these records.

---

## Implementation Phases

### Phase 1: Backend - History Lookup Helper

Create a new helper function in the `sales-coach` edge function to fetch purchase history by customer name with fuzzy matching:

**Matching Logic:**
1. Extract first/last name parts from the company name
2. Handle multi-person entries (e.g., "Zierke Bros" → search all Zierkes)
3. Search both "LAST, FIRST" and "FIRST LAST" patterns
4. Return aggregated purchase data (total revenue, products, seasons)

This reuses the existing `fetchAllPurchaseHistory` function with the same name normalization logic.

---

### Phase 2: Auto-Include History in Deal Context

Update the `sales-coach` edge function to automatically fetch purchase history when a deal is provided:

**When a deal object is passed:**
1. Get the company name from `deal.sales_companies.name`
2. Call the purchase history lookup
3. Include the results in the deal context sent to the AI
4. Jericho now knows their full buying history without being asked

**Example context addition:**
```text
HISTORICAL PURCHASE DATA FOR THIS CUSTOMER:
- Total Revenue: $45,230 (23 transactions)
- Products: Fertilizer, Nitrogen, Specialty Chem
- Seasons Active: 2022, 2023, 2024
- Top Products: [detailed list]
```

---

### Phase 3: UI - Display History in Deal Views

Add a "Purchase History" section to multiple locations:

**A. DealCoachDialog (src/components/sales/DealCoachDialog.tsx)**
- Add a collapsible "Purchase History" card below the deal summary
- Show: Total revenue, transaction count, top products, last purchase date
- Indicate if no history found (prospect vs. data gap)

**B. CustomerDetailDialog (src/components/sales/CustomerDetailDialog.tsx)**
- Enhance the existing "History" tab to pull from `customer_purchase_history`
- Add a "Transactions" sub-section with product breakdown
- Show year-over-year trends

**C. PipelineView Deal Cards (src/components/sales/PipelineView.tsx)**
- Add a small indicator badge showing if historical data exists
- On hover or click, show quick revenue summary

---

### Phase 4: New API Endpoint (Optional Enhancement)

Create a dedicated edge function `get-customer-purchase-summary` that:
- Takes a customer name as input
- Returns structured JSON with purchase summary
- Can be called directly from UI components
- Caches results for performance

This allows the frontend to fetch history independently without going through the full coaching flow.

---

## Technical Details

### Fuzzy Name Matching Algorithm

```text
Input: "Zierke Bros"
Steps:
1. Normalize: Remove common suffixes (Bros, Farms, Inc)
2. Extract key name: "Zierke"
3. Query: WHERE customer_name ILIKE '%ZIERKE%'
4. Return all matching records aggregated

Input: "Tim Murray"
Steps:
1. Split: first="Tim", last="Murray"
2. Query: WHERE customer_name ILIKE '%MURRAY%' AND customer_name ILIKE '%TIM%'
3. Catches: "MURRAY, TIM" and "TIM MURRAY"
```

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/sales-coach/index.ts` | Add auto-history lookup when deal is provided |
| `src/components/sales/DealCoachDialog.tsx` | Display purchase history summary |
| `src/components/sales/CustomerDetailDialog.tsx` | Add transactions tab with history data |
| `src/components/sales/PipelineView.tsx` | Add history indicator badge |
| (new) `supabase/functions/get-customer-purchase-summary/index.ts` | Dedicated history lookup API |

### Data Flow

```text
User clicks deal in pipeline
        ↓
DealCoachDialog opens
        ↓
Calls sales-coach with deal object
        ↓
sales-coach extracts company name
        ↓
Fuzzy matches against customer_purchase_history
        ↓
Returns AI response with embedded history context
        ↓
UI displays history summary in dialog
```

---

## Edge Cases

1. **No match found**: Display "No purchase history found - this appears to be a new prospect"
2. **Multiple matches**: Aggregate all matching records (handles family operations like Zierke Bros)
3. **Name variations**: The fuzzy matching handles common variations (Tim/Timothy, etc.)
4. **Prospects vs. current customers**: Use `customer_type` field to set expectations

---

## Summary

This gives reps:
1. **Automatic context** - Jericho knows their purchase history without being asked
2. **Visual indicators** - See at a glance which deals have historical data
3. **Quick access** - View full transaction history from any deal dialog
4. **Smarter coaching** - AI recommendations based on actual buying patterns

The existing name-matching logic from the "Rec mode" direct history lookup is reused, ensuring consistency across chat queries and automated lookups.
