

# Plan: Backboard-Primary Persistent Memory for Jericho Sales Agent

## Problem Summary

Jericho's memory in Sales Agent is fundamentally broken:

1. **Current state**: Memory is fragmented across 5+ database tables (`sales_coach_messages`, `jericho_action_log`, `sales_company_intelligence`, `customer_insights`, `conversation_messages`) with no unified retrieval
2. **Backboard integration is failing**: DNS errors prevent sync to Backboard.io, and the sync is fire-and-forget (non-blocking), so failures silently accumulate
3. **Memory loading is query-dependent**: The `loadCustomerMemory()` function only runs when a customer name is detected in the message - if you say "what did we talk about?" without a name, no memory loads
4. **No active customer context**: Each message is processed in isolation without knowing which customer the user is currently focused on

## Solution Architecture

Make **Backboard.io the primary memory system** with the database as backup. This gives you:
- Infinite context window through Backboard's thread persistence
- Automatic memory consolidation (Backboard handles this)
- Consistent behavior across sessions (the same thread ID = same memory)

### Key Changes

```text
CURRENT FLOW (broken):
User message → Detect entities → Load fragmented DB data → LLM → Response → Fire-and-forget Backboard sync (often fails)

NEW FLOW (proposed):
User message → Get/Create Backboard thread → Backboard API call (includes full history) → LLM response → Save to DB backup
```

## Implementation Phases

### Phase 1: Per-Customer Backboard Threads

Instead of one thread per user, create one thread **per user + customer combination**. This gives laser-focused memory for each customer relationship.

**Database change**: Modify `backboard_threads` table to include `customer_id`:
```sql
ALTER TABLE backboard_threads ADD COLUMN customer_id uuid REFERENCES sales_companies(id);
CREATE UNIQUE INDEX backboard_threads_user_customer_idx ON backboard_threads(profile_id, customer_id, context_type);
```

**New thread structure**:
- `profile_id` + `customer_id` (nullable) + `context_type` = unique thread
- When customer_id is NULL, it's a general sales thread
- When customer_id is set, it's a customer-specific memory thread

### Phase 2: Active Customer Tracking (UI + Backend)

Add a simple customer context selector to Sales Agent:

**Frontend (SalesTrainer.tsx)**:
- Add a dropdown/autocomplete at the top of the chat that shows your customers
- When selected, store `activeCustomerId` in state
- Pass `activeCustomerId` to every sales-coach API call
- Infer customer from message as fallback (current behavior)

**Backend (sales-coach/index.ts)**:
- Accept `activeCustomerId` in request body
- If provided, use that customer's Backboard thread
- If not provided, infer from message (current behavior)
- Return `inferredCustomerId` so UI can update selection

### Phase 3: Backboard as Primary Memory Source

Rewrite the response generation to use Backboard's memory instead of database queries:

**Step 1: Pre-load Backboard memory**
```typescript
// Before generating response
const backboardThread = await getOrCreateBackboardThread(
  client, 
  userId, 
  'sales', 
  activeCustomerId // New parameter
);

if (backboardThread) {
  // Get last N messages from Backboard (their API returns full history)
  const backboardMemory = await backboard.getMessages(backboardThread.threadId);
  context.backboardMemory = backboardMemory.slice(-50); // Last 50 turns
}
```

**Step 2: Include in prompt**
Instead of the fragmented `loadCustomerMemory()` that queries 5 tables:
```typescript
// Include Backboard memory as primary context
if (context.backboardMemory?.length > 0) {
  systemPrompt += `\n\n**YOUR MEMORY OF THIS CUSTOMER:**\n`;
  systemPrompt += context.backboardMemory.map(m => 
    `${m.role === 'user' ? 'User' : 'You'}: ${m.content}`
  ).join('\n\n');
}
```

**Step 3: Reliable sync (blocking, with retry)**
Change from fire-and-forget to blocking with retry:
```typescript
// After generating response
try {
  await backboard.syncMessage(backboardThread.threadId, 'user', message);
  await backboard.syncMessage(backboardThread.threadId, 'assistant', responseMessage);
} catch (err) {
  console.error("Backboard sync failed:", err);
  // Fall back to database-only storage (already happening)
}
```

### Phase 4: Database as Backup (Keep Current Behavior)

The existing database storage continues as backup:
- `sales_coach_messages` - keeps working
- `jericho_action_log` with `conversation_backup` - keeps working
- `sales_company_intelligence` - keeps working

If Backboard is unavailable, the system falls back to database queries (degraded but functional).

### Phase 5: Deterministic Data Queries (Bypass Memory)

For factual queries (purchase history, revenue, etc.), bypass both Backboard and LLM entirely:

Expand the existing deterministic handlers:
- `handleParetoAnalysis()` - already exists
- Add `handlePurchaseHistoryQuery()` - direct SQL for "what did X buy"
- Add `handleRevenueQuery()` - direct SQL for "how much revenue from X"
- Add `handleDealStatusQuery()` - direct SQL for "where are we with X"

These return formatted markdown responses without LLM interpretation.

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/_shared/backboard-client.ts` | Add customer-specific thread support, retry logic |
| `supabase/functions/sales-coach/index.ts` | Accept `activeCustomerId`, use Backboard as primary memory, add deterministic handlers |
| `src/pages/SalesTrainer.tsx` | Add customer selector UI, pass `activeCustomerId` to API |
| `src/components/sales/SalesAgentHeader.tsx` | Add customer dropdown component |
| Database migration | Add `customer_id` to `backboard_threads` table |

## Technical Details

### Backboard Thread Naming Convention
```
Jericho-sales-{userId}-{customerId}   // Customer-specific
Jericho-sales-{userId}-general        // General sales chat
```

### Customer Inference Logic (Fallback)
```typescript
// 1. Check if activeCustomerId provided
// 2. If not, check extracted.companies[0]
// 3. If not, check extracted.contacts[0] and find their company
// 4. If still not, use "general" thread
```

### Memory Window Sizes
- Backboard: Last 50 turns (full context in thread)
- Database backup: Last 20 messages (current behavior)
- Deterministic queries: Full data (no truncation)

## Expected Outcome

After implementation:
- **"What did we talk about with Randy?"** → Pulls from Backboard thread for Randy, shows full history
- **"Where did we leave off?"** (with Randy selected) → Uses active customer context
- **"What did Randy buy last year?"** → Deterministic SQL query, 100% accurate
- **5 days later, same customer** → Same Backboard thread, full memory intact
- **Backboard down?** → Falls back to database queries (degraded but works)

## Rough Complexity

- Phase 1 (DB migration + thread changes): ~50 lines
- Phase 2 (UI customer selector): ~100 lines
- Phase 3 (Backboard primary memory): ~150 lines in sales-coach
- Phase 4 (already exists, no changes)
- Phase 5 (deterministic handlers): ~200 lines

Total: ~500 lines of code changes across 5 files

