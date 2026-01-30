
# Fix: Pipeline-First Query Routing

## Problem Identified

When you ask "Where did we leave it with Randy?", Jericho is:
1. Classifying this as a "research" intent 
2. Running a Perplexity web search for "Randy"
3. Finding "Randy's" - an irrelevant smoking accessories company
4. Showing that external data before your pipeline data

**Randy Diekhoff IS in your pipeline** with rich notes, but the system is prioritizing external research over internal data.

## Root Cause

Three issues in `supabase/functions/sales-coach/index.ts`:

1. **Intent detection gap** - Phrases like "where did we leave it" aren't recognized as internal lookups
2. **Research runs unconditionally** - If `researchRequest` is set, external search happens without checking pipeline first
3. **Fuzzy matching too strict** - "Randy D" doesn't match "Randy Diekhoff" in context gathering

## Solution

### 1. Update Intent Detection Prompt (lines 302-332)

Add explicit rules to recognize status/history questions as internal lookups:

```text
CRITICAL CONTEXT RULES:
- "where did we leave it", "what's the status", "last time we talked", 
  "catch me up on", "what do we know about" = INTERNAL LOOKUP (intentType: "data_lookup")
- ONLY set researchRequest when user explicitly says "research", "look up online", 
  "find out about" [company that doesn't exist in pipeline]
- If the name sounds like a person/farm, assume it's a PIPELINE customer first
```

### 2. Add Pipeline-First Check Before Research (lines 206-218)

Before calling `handleResearch`, verify the entity doesn't exist in the pipeline:

```typescript
// Handle research request - BUT ONLY if not in pipeline
if (extracted.researchRequest && effectiveUserId) {
  const requestedName = extracted.researchRequest.toLowerCase();
  const existsInPipeline = context.existingCompanies.some(
    (c: any) => c.name.toLowerCase().includes(requestedName) ||
                requestedName.includes(c.name.toLowerCase().split(' ')[0])
  ) || context.deals.some(
    (d: any) => d.deal_name.toLowerCase().includes(requestedName)
  );

  if (!existsInPipeline) {
    const researchResult = await handleResearch(...);
    if (researchResult) researchCompleted = researchResult;
  } else {
    console.log("Skipping external research - entity found in pipeline:", requestedName);
  }
}
```

### 3. Improve Fuzzy Name Matching in Context Gathering (lines 460-489)

Make matching work for partial names like "Randy D" → "Randy Diekhoff":

```typescript
// Fuzzy match: check if first name + initial matches
const normalizedSearch = companyName.toLowerCase().trim();
const existingCompany = context.existingCompanies.find((c: any) => {
  const existingName = c.name.toLowerCase().trim();
  // Exact match
  if (existingName === normalizedSearch) return true;
  // First name match (Randy D → Randy Diekhoff)
  const searchParts = normalizedSearch.split(/\s+/);
  const existingParts = existingName.split(/\s+/);
  if (searchParts[0] === existingParts[0]) {
    // Check if second part is initial or matches start
    if (!searchParts[1]) return true; // Just first name
    if (existingParts[1]?.startsWith(searchParts[1])) return true;
  }
  return false;
});
```

### 4. Improve Customer Memory Loading Fuzzy Match (lines 1470-1475)

Same pattern - allow partial name matching:

```typescript
// Allow matching "Randy" or "Randy D" to "Randy Diekhoff"
const namePatterns = customerName.split(/\s+/);
const firstName = namePatterns[0];
const { data: salesCompany } = await client
  .from("sales_companies")
  .select("id, name")
  .eq("profile_id", userId)
  .or(`name.ilike.%${customerName}%,name.ilike.${firstName}%`)
  .maybeSingle();
```

---

## Expected Behavior After Fix

**User asks:** "Where did we leave it with Randy?"

**Jericho response:**
```
Randy Diekhoff is in your prospecting stage.

Here's what I have on him:
- Farms 2,650 acres (1,500 corn / 1,150 soybeans)
- Split decisions with brother (brother is skeptical)
- Open to new products but conservative
- Responds to side-by-side comparisons
- Concerned about: yield on sloping acres, 10-34-0 on high-pH, TuneUp+ cost

To move Randy forward, let's get a meeting on the books...
```

**No external web research** - pipeline data takes priority.

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/sales-coach/index.ts` | All 4 changes above |

---

## Technical Summary

- **Intent Detection**: Expand "data_lookup" trigger phrases to include status/history questions
- **Research Gating**: Add pipeline check before external research
- **Fuzzy Matching**: Allow partial names (first name + initial) to match full names
- **Result**: Internal pipeline data always takes priority over external web searches
