
# Agentic Product Training System - IMPLEMENTED ✅

## Overview

Transformed the Bite-Sized Training section into a fully agentic, company-specific training creation system. Users select a **product** (dynamically parsed from their knowledge base) and optionally a **customer** to generate hyper-personalized training content explaining product value - suitable for training reps or sharing directly with customers as value-add MP3s.

**Universal Standard**: Your sales methodology training (ACAVE, discovery questions, objection handling) is global and available to all companies. Product training is company-specific.

---

## Changes Completed ✅

| File | Change | Status |
|------|--------|--------|
| `src/components/sales/SalesAgentHeader.tsx` | Fixed line 399 to use `viewAsCompanyId` for proper company isolation | ✅ Done |
| `src/components/sales/SalesKnowledgePodcasts.tsx` | Added product extraction, replaced dropdowns (Product + Customer), added product-specific generation | ✅ Done |
| `supabase/functions/generate-sales-podcast/index.ts` | Added `productName` parameter, extracts product-specific content from catalogs | ✅ Done |

---

## User Experience

### New Dropdown Layout

```text
+-----------------------------------------------------+
| [Product ▼]                  [Customer ▼]           |
|                                                     |
| Product:                     Customer:              |
|   All Training (default)       General (default)    |
|   ─────────────                ─────────────        |
|   Streamline Catalog:          Derek Holmgren       |
|     • BioVax                   Scott Robertson      |
|     • CropFit Complete         Mike Johnson         |
|     • SeedShield               ...                  |
|   Rob-See-Co Seed:                                  |
|     • Duracade                                      |
|     • SmartStax PRO                                 |
+-----------------------------------------------------+
```

### Combinations Enabled

- **Product + Customer** = "Here's why BioVax could help Derek's operation..."
- **Product only** = General product value training for any customer
- **Customer only** = General coaching for that customer (existing behavior)
- **Neither** = Standard methodology training (existing behavior)

---

## What Each Company Sees

| Company | Products Dropdown | Customers Dropdown | Sales Training |
|---------|-------------------|-------------------|----------------|
| Streamline | Rob-See-Co products, Streamline catalog | Streamline customers | Global (your methodology) |
| Momentum | Tidal Grow, AllChem products | Momentum customers | Global (your methodology) |
| Any Company | Their own product catalogs | Their own customers | Global (your methodology) |

---

## How It Works End-to-End

1. **Rep opens Training tab** → Products parsed from their company's knowledge base
2. **Selects "BioVax" + "Derek Holmgren"** → UI shows personalized mode banner (orange for products)
3. **Clicks "Create Episodes"** → Edge function:
   - Fetches BioVax section from Streamline catalog
   - Fetches Derek's operation details
   - AI generates 3-5 episodes: "Why BioVax Fits Derek's Operation", "Talking Points for Your Call", etc.
4. **Rep downloads MP3** → Shares with Derek or listens during commute

---

## Technical Details

### Product Extraction Logic
Products are extracted from `### Headers` in knowledge base markdown content. Only knowledge items categorized as product training (product_catalog, product_sheet, technical, biologicals, seed, chemicals, crop_protection) are parsed.

### Edge Function Enhancement
The `productName` parameter triggers:
1. Content isolation - extracts just that product's section from the catalog
2. AI prompt enhancement - focuses on value proposition and talking points
3. Customer personalization - combines product focus with customer operation details

### Company Isolation
The `companyId` prop now respects the "View As" context, ensuring super admins see the correct company's products and customers when viewing as another company.
