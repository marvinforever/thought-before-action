
# Fix: Pipeline Additions Not Working

## Problem Identified

Jericho claims to add companies/deals to the pipeline but they're not being created. The logs show:

```
Error creating company: {
  code: "PGRST204",
  message: "Could not find the 'company_id' column of 'sales_companies' in the schema cache"
}
```

**Root Cause:** The `sales-coach` edge function is using the wrong column name. It's trying to:
- Query with `.eq("company_id", ...)` 
- Insert `company_id` into the record

But the `sales_companies` table has **no `company_id` column** - it uses `profile_id` to link records to users.

---

## Database Schema Reality

| Table | How it links to user |
|-------|---------------------|
| `sales_companies` | `profile_id` (direct FK to profiles) |
| `sales_contacts` | `profile_id` + `company_id` (FK to sales_companies.id) |
| `sales_deals` | `profile_id` + `company_id` (FK to sales_companies.id) |

The `company_id` column in `sales_contacts` and `sales_deals` refers to the **sales company** (customer), not the organization.

---

## Fixes Required

### 1. Edge Function: `supabase/functions/sales-coach/index.ts`

**Context Gathering (line ~408):**
```typescript
// BEFORE (wrong)
.eq("company_id", companyId)

// AFTER (correct)
.eq("profile_id", userId)
```

**Duplicate Check (lines ~461-465):**
```typescript
// BEFORE (wrong)
.eq("company_id", companyId)

// AFTER (correct)
.eq("profile_id", userId)
```

**Company Insert (lines ~479-488):**
```typescript
// BEFORE (wrong)
.insert({
  company_id: companyId,
  profile_id: userId,
  name: name.trim(),
  status: "active",
})

// AFTER (correct - remove company_id, remove non-existent status column)
.insert({
  profile_id: userId,
  name: name.trim(),
})
```

### 2. Frontend: `src/components/sales/SalesCoachChat.tsx` (line ~61)

```typescript
// BEFORE (wrong)
.eq("company_id", companyId)

// AFTER (correct)
.eq("profile_id", userId)
```

### 3. Frontend: `src/pages/SalesTrainer.tsx` (line ~91)

```typescript
// BEFORE (wrong)
.eq("company_id", effectiveCompanyId)

// AFTER (correct)
.eq("profile_id", effectiveUserId)
```

---

## Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `supabase/functions/sales-coach/index.ts` | ~408 | Change `.eq("company_id", companyId)` to `.eq("profile_id", userId)` |
| `supabase/functions/sales-coach/index.ts` | ~464 | Change `.eq("company_id", companyId)` to `.eq("profile_id", userId)` |
| `supabase/functions/sales-coach/index.ts` | ~481-486 | Remove `company_id` and `status` from insert |
| `src/components/sales/SalesCoachChat.tsx` | ~61 | Fix query filter |
| `src/pages/SalesTrainer.tsx` | ~91 | Fix query filter |

---

## What This Fixes

After these changes:
- Companies will actually be created when Jericho says "Added ABC Farms"
- Contacts will be linked correctly
- Deals will be created in the pipeline
- Undo functionality will work
- The customer dropdown in chat will populate correctly

---

## Testing After Fix

1. Open Sales Agent chat
2. Say "I just met John at ABC Farms about seed treatment"
3. Verify:
   - Toast shows "Company Added" with Undo button
   - Company appears in Companies tab
   - Deal appears in Pipeline
