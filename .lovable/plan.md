
# Add Momentum Company to 4-Call Tracker Access

## Summary

Grant Momentum Company users access to the 4-Call Tracker and related Stateline methodology features. This is a simple one-line change.

## Change Required

**File:** `src/pages/SalesTrainer.tsx`

**Current code (line 193):**
```typescript
setHasMethodologyAccess(profileData?.company_id === STATELINE_COMPANY_ID);
```

**Updated code:**
```typescript
const MOMENTUM_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
setHasMethodologyAccess(
  profileData?.company_id === STATELINE_COMPANY_ID || 
  profileData?.company_id === MOMENTUM_COMPANY_ID
);
```

## What This Enables for Momentum Company Users

Once implemented, Momentum Company users will see these features:

1. **4-Call Tracker button** - The yellow quick action button to open the tracker
2. **Generate 4-Call Plan** - Ask Jericho to create a plan
3. **Season Review tips** - Quick action for season review guidance  
4. **111.4 Strategy** - Quick action for the 111.4 goal discussion

## Reversibility

To turn off access later, simply remove `|| profileData?.company_id === MOMENTUM_COMPANY_ID` from the condition.

---

## Technical Details

**Constant Addition:**
Add `MOMENTUM_COMPANY_ID` constant near line 33 where `STATELINE_COMPANY_ID` is defined:
```typescript
const STATELINE_COMPANY_ID = 'd32f9a18-aba5-4836-aa66-1834b8cb8edd';
const MOMENTUM_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
```

**Logic Update:**
Modify the access check on line 193 to include both company IDs.
