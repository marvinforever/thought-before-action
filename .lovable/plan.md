
# AI-Powered Prospect Research & Auto-Population

## Overview
Enable Jericho to research companies matching your ideal customer profile (ICP) and automatically populate them into your prospect list. Two approaches:

1. **List-based research**: Give Jericho a list of company names → she researches each and adds them with enriched data
2. **ICP-based discovery**: Describe your target customer demographic → Jericho finds matching companies and adds them

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                    User Interaction Flow                        │
├─────────────────────────────────────────────────────────────────┤
│  User: "Find me ag co-ops in Iowa with $10M+ revenue"          │
│                            ↓                                    │
│  Jericho detects research request                               │
│                            ↓                                    │
│  [PROSPECT_RESEARCH] block triggers edge function               │
│                            ↓                                    │
│  Perplexity API → Real company data with citations              │
│                            ↓                                    │
│  Companies auto-created in sales_companies table                │
│                            ↓                                    │
│  Jericho responds: "Found 8 co-ops matching your criteria..."   │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. New Edge Function: `research-prospects`
- Uses Perplexity API (already configured with `PERPLEXITY_API_KEY`)
- Accepts either a list of company names OR an ICP description
- Returns structured company data with web citations
- Handles both search modes:
  - **Named search**: `{ companies: ["ABC Co-op", "XYZ Farms"] }`
  - **ICP search**: `{ icp: "Agricultural cooperatives in the Midwest with 50+ employees" }`

### 2. Extend `sales-coach` Function
- Add new detection block: `[PROSPECT_RESEARCH]`
- When detected, call `research-prospects` function
- Parse results and auto-create `sales_companies` records
- Return friendly summary to user with what was found

### 3. Database Additions
- Add `source` column to `sales_companies` (values: `manual`, `ai_research`, `import`)
- Add `research_citations` JSONB column for storing source URLs
- Add `research_date` timestamp to track when data was gathered

### 4. Enhanced System Prompt
Update Jericho's instructions to recognize prospect research requests:
- "Find me companies that..."
- "Research these prospects: ..."
- "I need leads in the [industry] space"
- "Who are potential customers in [location]?"

## Sample Conversations

**ICP-Based Discovery:**
> User: "Find me agricultural retailers in Nebraska with at least 5 locations"
>
> Jericho: "I found 6 ag retailers in Nebraska matching your criteria:
> 1. **Central Valley Ag** - 12 locations, $180M revenue, headquarters in York
> 2. **CVA Cooperative** - 8 locations, $95M revenue, serves central Nebraska
> ... (etc)
>
> I've added all 6 to your prospect list. Would you like me to create deals for any of these?"

**List-Based Research:**
> User: "Research these companies for me: Tidal Grow, AgriGold Partners, Heartland Seed"
>
> Jericho: "Here's what I found:
> - **Tidal Grow** - Specialty crop inputs, based in Des Moines, ~$25M revenue
> - **AgriGold Partners** - Seed dealer network, 15 locations across Iowa
> - **Heartland Seed** - Couldn't find detailed info - may be a local operation
>
> Added the first two to your prospects. Want me to dig deeper on Heartland Seed?"

## Technical Implementation

### New Files
- `supabase/functions/research-prospects/index.ts` - Perplexity-powered research engine

### Modified Files
- `supabase/functions/sales-coach/index.ts` - Add `[PROSPECT_RESEARCH]` detection and handling
- `supabase/config.toml` - Register new function

### Database Migration
```sql
ALTER TABLE sales_companies 
  ADD COLUMN source TEXT DEFAULT 'manual',
  ADD COLUMN research_citations JSONB,
  ADD COLUMN research_date TIMESTAMPTZ;
```

## Key Features

1. **Web-grounded research** - Perplexity provides real, citable company information
2. **Duplicate detection** - Won't add companies already in your list
3. **Quality scoring** - Ranks prospects by ICP fit
4. **Citation tracking** - Links to sources so you can verify data
5. **Conversational flow** - Natural back-and-forth with Jericho
6. **Batch or single** - Research one company or discover many at once

## Security & Limits
- Rate limiting on Perplexity calls (5 researches per minute)
- Results capped at 15 companies per search to avoid noise
- Citations stored for audit trail
- Only adds to the requesting user's profile
