
# Targeted Accounts Import System

## Overview
Import your December 2025 targeted prospects and growth customers as deals in the sales pipeline. Each seller gets their assigned accounts pre-loaded with estimated acres, customer type, and growth category targets.

---

## Phase 1: Schema Enhancements

Add three new columns to the `sales_deals` table to capture the targeted account data:

### New Columns
| Column | Type | Purpose |
|--------|------|---------|
| `estimated_acres` | integer | Farm size for opportunity sizing |
| `customer_type` | text | 'prospect' or 'current_customer' |
| `target_categories` | jsonb | Structured growth targets |

### Target Categories Structure
```text
{
  "primary": "Fertilizer",
  "secondary": "Chemical",
  "tertiary": "Seed"
}
```

---

## Phase 2: Import Edge Function

Create a new `import-targeted-accounts` edge function that:

1. **Parses CSV data** with columns:
   - seller, farmer_name, estimated_acres, type_of_customer
   - primary_growth_category, secondary_growth_category, third_growth_category
   - notes (optional)

2. **Matches sellers to profiles** using fuzzy name matching against existing Stateline profiles

3. **Creates or links companies:**
   - Check if farmer already exists in `sales_companies` for that rep
   - Create new company record if not found
   - Use the `operation_details` JSONB field to store acres

4. **Creates deals with:**
   - `deal_name`: "{Farmer Name} - 2026 Growth Target"
   - `stage`: "prospecting" for prospects, "discovery" for current customers
   - `estimated_acres`: from CSV
   - `customer_type`: 'prospect' or 'current_customer'
   - `target_categories`: { primary, secondary, tertiary }
   - `notes`: any additional notes from CSV

---

## Phase 3: Admin Import UI

Add a "Targeted Accounts" import section in Super Admin with:

- Company selector (defaults to Stateline)
- CSV paste area
- Preview of parsed records with seller matching
- Import button with progress indicator

---

## Phase 4: Pipeline UI Updates

### Pipeline View Enhancements
- Show a badge for customer type (prospect vs growth)
- Display primary category as a tag on the deal card
- Show acres in the deal details

### Deal Card Display
```text
+---------------------------------+
| Scott Robertson                 |
| 🌱 Fertilizer | 1,200 ac       |
| [PROSPECT]                      |
+---------------------------------+
```

### DealsTable Enhancements
- Add columns for Acres, Type, and Primary Category
- Allow filtering by customer type and category

---

## Phase 5: Jericho Integration

Update the `sales-coach` edge function to:

1. Include `target_categories` when building customer context
2. When discussing a deal, Jericho knows:
   - "This is a prospect with 1,200 acres"
   - "Primary target is Fertilizer, secondary is Chemical"
3. Tailor recommendations to the targeted product areas

---

## Technical Details

### Database Migration
```text
ALTER TABLE sales_deals 
  ADD COLUMN estimated_acres integer,
  ADD COLUMN customer_type text,
  ADD COLUMN target_categories jsonb;
```

### Rep-to-Profile Mapping
The following sellers from your CSV map to existing profiles:

| CSV Seller | Profile ID |
|------------|------------|
| Christian O'Banion | db6e428d-380f-483a-a259-55b622580a79 |
| Joel Loseke | eac605a2-c833-4597-a5c2-cc6e6e5d4e03 |
| Ed Lehman | c4e346de-156d-4410-bfcf-ce11d0ac4e6b |
| Kally Windschitl | 30b712c0-ad7a-4e1a-bb06-010a1ec9cfee |
| Kelli Barnett | 0fae7e33-0a6e-4689-ad65-9e0cb758f6c7 |
| Clay Mogard | 5ddb139c-4453-4bb4-ad89-9fd7266ec13b |
| Ben Borchardt | 2d69e5f5-d964-4bb0-9bca-55bcfba93850 |
| Blake Miller | 176bee82-5595-4941-956a-52ff8ff0eb90 |
| Trevor Kluver | ab3d266a-bd68-4c35-b441-f5e6c7d9fa1b |

### Import Validation
- Verify all sellers match existing profiles before import
- Flag any unmatched sellers for manual review
- Deduplicate against existing deals by farmer name

---

## Summary

This implementation gives you:
1. **73 deals pre-loaded** across 9 reps with full targeting data
2. **Visual clarity** in the pipeline showing what type of customer and which products to focus on
3. **AI-powered coaching** that knows exactly what to recommend for each account
4. **Repeatable process** for future targeted account lists

The data enriches both the CRM pipeline and Jericho's context, making the system truly useful for field reps planning their outreach.
