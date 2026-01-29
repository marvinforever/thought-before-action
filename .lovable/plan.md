

# Multi-Issue Fix Plan: Sales Agent Improvements

## Issues Identified

| # | Issue | Root Cause |
|---|-------|------------|
| 1 | **Chat history lost after logout** | Conversation loads based on `company_id` - when no company is selected, messages from last night's session aren't loaded |
| 2 | **Default to Momentum Company** | When logged in as Mark (without "View As"), the system should auto-default to "The Momentum Company" context |
| 3 | **Deal formatting shows "VP of HR"** | Contact titles are being included in deal names instead of just company name |
| 4 | **Auto-create contacts when entering company + people** | When Jericho detects people mentioned with a company, create them as CRM contacts automatically |
| 5 | **Hide Field Maps by default** | Field Maps tab is always visible - should be gated by company/user setting |
| 6 | **Pipeline not saving overnight** | Related to Issue #1 - deals were likely being saved but loaded under wrong context |

---

## Solution Architecture

### Issue 1 & 2: Conversation Loading + Default Momentum Context

**Problem**: When you log in, the conversation loads based on `profile.company_id`, but your conversations last night may have been with a "View As" company context. Also, as a super admin with The Momentum Company, you should default to that context.

**Fix**:
- When a super admin logs in with `company_id = '00000000-0000-0000-0000-000000000001'` (Momentum), automatically set `viewAsCompanyId` to that value
- Load conversation based on the user's ACTUAL company (Momentum) instead of requiring manual selection
- This ensures continuity between sessions

**Files to modify**:
- `src/pages/SalesTrainer.tsx` - Add logic to auto-set Momentum as default context for Momentum employees

---

### Issue 3: Deal Name Formatting

**Problem**: When Jericho creates deals, it sometimes uses contact titles (like "VP of HR") in the deal name.

**Fix**: Change deal name format to prioritize company name only:
- Deal name: `{Company Name}` (not `{Contact} - {Company}`)
- Store contact name in the `notes` field or link to a separate contact record

**Files to modify**:
- `supabase/functions/sales-coach/index.ts` - Update deal creation logic

---

### Issue 4: Auto-Create Contacts from Conversation

**Problem**: When you mention people in a company (e.g., "I'm working with Cooperative Producers and talking to John Smith and Mary Johnson"), Jericho should automatically create those as contacts in the CRM.

**Solution**: Extend the `[DEAL_DETECTED]` block to include multiple contacts, then create them in `sales_contacts` table.

**New block format**:
```
[DEAL_DETECTED]
company_name: Cooperative Producers
contacts: John Smith (CEO), Mary Johnson (Ops Manager), Tim Brown
stage: discovery
value: 50000
notes: Initial meeting scheduled
[/DEAL_DETECTED]
```

**Backend changes**:
- Parse the `contacts` field (comma-separated list with optional titles in parentheses)
- Create each person in `sales_contacts` linked to the `sales_companies` record
- Mark the first contact as `is_primary = true`

**Files to modify**:
- `supabase/functions/sales-coach/index.ts` - Extend deal detection to parse and create contacts

---

### Issue 5: Field Maps Feature Gating

**Problem**: The "Field Maps" tab appears for all users, but it should only be visible for companies that use this feature (e.g., agricultural companies).

**Solution**: Add a company-level setting `enable_field_maps` and check it before rendering the tab.

**Database changes**:
```sql
-- Add settings JSONB column to companies if not exists
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- Enable for specific companies
UPDATE companies 
SET settings = jsonb_set(COALESCE(settings, '{}'), '{enable_field_maps}', 'true')
WHERE id IN (
  'd32f9a18-aba5-4836-aa66-1834b8cb8edd', -- Stateline
  'd23e3007-254d-429a-a7e2-329bc1bf2afb'  -- Streamline Ag
);
```

**Frontend changes**:
- Fetch company settings in SalesTrainer
- Pass `enableFieldMaps` prop to CustomerDetailDialog
- Conditionally render the Field Maps tab

**Files to modify**:
- Database migration to add settings column
- `src/pages/SalesTrainer.tsx` - Fetch company settings
- `src/components/sales/CustomerDetailDialog.tsx` - Accept `enableFieldMaps` prop and conditionally render tab

---

## Implementation Steps

### Step 1: Database Migration (Field Maps gating)
- Add `settings` JSONB column to `companies` table
- Populate `enable_field_maps: true` for agricultural companies (Stateline, Streamline Ag)

### Step 2: Update SalesTrainer.tsx
- Auto-set `viewAsCompanyId` to user's own `company_id` when loading (for Momentum employees)
- Fetch company settings including `enable_field_maps`
- Pass settings to child components

### Step 3: Update CustomerDetailDialog.tsx
- Add `enableFieldMaps?: boolean` prop
- Conditionally render the Field Maps tab based on this prop

### Step 4: Update sales-coach Edge Function
- Fix deal name format to use company name only
- Parse `contacts:` field from DEAL_DETECTED block
- Auto-create contacts in `sales_contacts` table linked to the company

### Step 5: Deploy and Test
- Deploy updated edge function
- Verify conversation history loads correctly
- Test auto-contact creation by mentioning people in chat
- Confirm Field Maps tab is hidden for non-ag companies

---

## Summary

This plan addresses all 6 identified issues:
1. Chat history loads correctly by defaulting to user's own company context
2. Momentum employees automatically operate as "The Momentum Company"
3. Deal names use company name only (not contact titles)
4. Contacts are auto-created when mentioned in conversation
5. Field Maps are hidden by default, enabled per-company
6. Formatting is restored by having proper conversation context

