
# Jericho: Production-Ready Agentic Sales Executive Assistant

## Status: ✅ Phase 1 Complete

### Completed
- [x] Database tables: `sales_company_intelligence`, `jericho_action_log`, `email_drafts` with RLS
- [x] Core `sales-coach` edge function with full agentic pipeline
- [x] Intent detection & entity extraction (Gemini Flash-Lite)
- [x] Autonomous company/contact/deal creation with duplicate prevention
- [x] Undo mechanism with action logging and 5-second toast window
- [x] Research integration (Perplexity API)
- [x] Email drafting capability
- [x] Pipeline action handling (move/update/delete deals)
- [x] Post-response insight extraction
- [x] Frontend undo toasts in SalesTrainer.tsx and SalesCoachChat.tsx

---

## Overview


## Architecture: The Agentic Pipeline

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER MESSAGE                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. FAST INTENT DETECTION (Gemini Flash-Lite)                               │
│     ─ Classify: coaching | data_lookup | create_entity | research | email  │
│     ─ Extract: company names, contact names/titles, deal signals           │
│     ─ Confidence scoring for ambiguous entities                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. CONTEXT ASSEMBLY                                                        │
│     ─ User pipeline (deals, stages, values)                                 │
│     ─ Customer intelligence profiles                                        │
│     ─ Knowledge base (company-specific training content)                    │
│     ─ Purchase history for mentioned customers                              │
│     ─ Existing companies/contacts (duplicate prevention)                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. ACTION EXECUTION (Parallel when possible)                               │
│     ─ Create companies/contacts/deals with undo tokens                      │
│     ─ Trigger research via Perplexity API                                   │
│     ─ Draft personalized emails with current events                         │
│     ─ Update customer intelligence profiles                                 │
│     ─ All actions logged to jericho_action_log                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. RESPONSE GENERATION                                                     │
│     ─ Conversational coaching response                                      │
│     ─ Action summaries with undo buttons                                    │
│     ─ Inline email drafts with copy button                                  │
│     ─ Research results with citations                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  5. POST-RESPONSE LEARNING                                                  │
│     ─ Extract insights from conversation (automatic)                        │
│     ─ Update customer intelligence profiles                                 │
│     ─ Store patterns in sales_coach_learning                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Changes

### New Tables

**1. `sales_company_intelligence`** - Deep customer profiles that Jericho builds over time

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| company_id | uuid | FK to sales_companies |
| profile_id | uuid | Owner's profile |
| key_contacts | jsonb | Names, roles, preferences |
| buying_signals | jsonb | Collected signals with timestamps |
| objections_history | jsonb | Objections and how they were handled |
| preferences | jsonb | Communication style, meeting times |
| relationship_notes | text | AI-synthesized relationship summary |
| competitive_intel | text | Competitor mentions |
| personal_details | jsonb | Hobbies, family, interests mentioned |
| research_data | jsonb | Web research results |
| last_research_at | timestamptz | When last researched |
| created_at / updated_at | timestamptz | Timestamps |

**2. `jericho_action_log`** - Audit trail for all autonomous actions (enables undo)

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key (also serves as undo token) |
| profile_id | uuid | User who triggered action |
| company_id | uuid | Company context |
| action_type | text | company_created, deal_created, contact_created, research_completed, insight_saved, email_drafted, entity_deleted |
| entity_type | text | company, deal, contact, etc. |
| entity_id | uuid | ID of created/modified entity |
| action_data | jsonb | Full details of what was done |
| triggered_by | text | The user message that triggered this |
| can_undo | boolean | Whether this action can still be undone |
| undone_at | timestamptz | When undone (null if not undone) |
| created_at | timestamptz | When action was taken |

**3. `email_drafts`** - AI-drafted emails ready for user review

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| profile_id | uuid | Owner |
| company_id | uuid | Customer company |
| deal_id | uuid | Optional deal association |
| sales_company_id | uuid | FK to sales_companies |
| recipient_name | text | Who the email is for |
| recipient_email | text | Email address (if known) |
| subject | text | Email subject line |
| body_text | text | Plain text version |
| personalization_context | text | What Jericho used to personalize |
| current_events_used | jsonb | News/events referenced |
| email_type | text | initial_outreach, follow_up, proposal, thank_you, check_in |
| status | text | draft, copied, archived |
| created_at | timestamptz | When drafted |

### RLS Policies

All new tables will have RLS enabled with policies matching existing patterns:
- Users can CRUD their own records (`profile_id = auth.uid()`)
- Super admins can view all (`is_super_admin(auth.uid())`)
- INSERT policies use `WITH CHECK (profile_id = auth.uid())`

---

## Core Features

### 1. Autonomous Entity Creation

**Trigger Detection:**
When user says something like:
- "I just talked to John Smith at ABC Farms..."
- "Had a great meeting with the Wilson Ag folks today..."
- "I'm thinking about reaching out to Cornerstone Seeds..."

**Processing Flow:**
1. Fast intent detection extracts: company name, contact names, titles, deal signals
2. Check existing `sales_companies` for fuzzy match (case-insensitive, trim whitespace)
3. If company doesn't exist: Create it with best-guess data
4. If contacts mentioned: Create them linked to the company
5. If deal signals present: Create deal in "prospecting" stage
6. Log all actions to `jericho_action_log` with undo tokens
7. Return natural response: "Got it! Added **ABC Farms** to your companies and created a prospecting deal. [Undo]"

**Ambiguity Handling (Best Guess + Notify):**
If "Wilson" could be Wilson Ag, Wilson Seeds, or a person:
- Jericho makes best guess based on context
- Response: "Added **Wilson** as a new company. Let me know if I got that wrong and I'll fix it!"

**Undo Mechanism:**
- Actions return an `undoToken` (the action log ID)
- Frontend shows toast with "Undo" button for 5 seconds
- Clicking undo calls `sales-coach` with `undoAction: <token>`
- Edge function soft-deletes the entities and marks action as undone

### 2. Deep Company Research (On Demand)

**Trigger Detection:**
- "Research ABC Farms for me"
- "What can you find out about this prospect?"
- "Tell me about Wilson Ag before my call"

**Processing Flow:**
1. Call existing `research-prospects` function with company name
2. Store results in `sales_company_intelligence.research_data`
3. Update `sales_companies.notes` with key findings
4. Return formatted research summary with citations

**Current Events Integration:**
- Call `fetch-industry-news` with company's industry
- Use Perplexity for company-specific news
- Store in intelligence profile for email personalization

### 3. Persistent Customer Intelligence

**Automatic Insight Extraction (After Every Message):**
1. Analyze conversation for customer-related signals
2. Extract and categorize:
   - **Buying signals**: "They're expanding their operation..."
   - **Objections**: "He mentioned price concerns..."
   - **Preferences**: "She prefers morning calls..."
   - **Personal details**: "His daughter plays volleyball..."
   - **Product interests**: "Asked about seed treatment..."
3. Save to `customer_insights` table (existing)
4. Synthesize into `sales_company_intelligence` for quick access

**Memory Retrieval:**
- When user mentions a customer, Jericho auto-loads their intelligence profile
- "What do I know about ABC Farms?" returns synthesized profile
- All previous mentions, preferences, and insights surfaced in context

### 4. AI-Powered Email Drafting

**Trigger Detection:**
- "Draft an email to John at ABC Farms"
- "Help me follow up with Wilson Ag"
- "Write a thank you note for yesterday's meeting"

**Processing Flow:**
1. Gather full context:
   - Customer intelligence profile
   - Recent conversation history
   - Purchase history
   - Deal stage and notes
2. Fetch current events:
   - Company-specific news via Perplexity
   - Local weather/agricultural conditions
   - Industry trends
3. Generate personalized email with:
   - Opening hook using current events
   - Value proposition tied to their needs
   - Call to action for deal stage
4. Save to `email_drafts` table
5. Display inline in chat with copy button

**Email Types:**
- Initial outreach (cold email with personalization hooks)
- Follow-up after meeting (references discussion points)
- Proposal summary
- Thank you note
- Check-in/nurture
- Seasonal outreach (pre-season planning, post-harvest review)

### 5. Self-Learning System

**Learning From Feedback:**
- Existing `sales_coach_feedback` (thumbs up/down) already in place
- Aggregate patterns into `sales_coach_learning` by company
- Inject learned patterns into system prompts
- "For customers like ABC Farms, approach X works best..."

**Learning From Actions:**
- Track which drafted emails get copied (mark status = 'copied')
- Track deal progression after Jericho's advice
- Identify successful patterns by customer type

---

## Error Handling & Graceful Degradation

### Production-Critical Safeguards

**1. API Failures:**
- If Perplexity fails: "I couldn't complete the research right now - try again in a moment?"
- If AI model fails: Return cached response or graceful fallback message
- If database write fails: Log error, show toast, don't lose user's message

**2. Rate Limiting:**
- 429 responses return user-friendly message: "I'm getting a lot of requests - give me a second..."
- Exponential backoff for retries

**3. Duplicate Prevention:**
- Case-insensitive, trimmed company name matching
- Check before creating: "Found existing company **ABC Farms** - using that instead of creating a duplicate."

**4. Timeout Protection:**
- Edge function timeout: 25 seconds
- If approaching timeout: Return partial results with "Still working on research..."

**5. Undo Safety:**
- Undo tokens expire after 5 seconds (frontend timer)
- Database enforces `can_undo` flag
- Undo only soft-deletes (set `is_active = false`) to prevent data loss

---

## Frontend Updates

### SalesCoachChat.tsx / SalesChatInterface.tsx Enhancements

**1. Action Notifications with Undo:**
```tsx
// Toast with undo button
toast({
  title: "Added ABC Farms",
  description: "Created company and prospecting deal",
  action: (
    <Button variant="outline" size="sm" onClick={() => undoAction(token)}>
      Undo
    </Button>
  ),
  duration: 5000,
});
```

**2. Email Draft Display:**
- Inline card showing subject and preview
- "Copy to Clipboard" button
- "Edit" opens modal for tweaks

**3. Research Results:**
- Collapsible card with company overview
- Citation links
- "Save to Notes" button

### Conversation Starters Update

Replace generic starters with action-oriented ones:
```typescript
const conversationStarters = [
  { label: "Just met someone", prompt: "I just met a potential customer..." },
  { label: "Need to follow up", prompt: "Help me follow up with..." },
  { label: "Research a prospect", prompt: "Research this company for me:" },
  { label: "Draft an email", prompt: "Draft an email to..." },
  { label: "Show my pipeline", prompt: "Show me my current pipeline" },
  { label: "Who should I call?", prompt: "Who should I prioritize calling today?" },
];
```

---

## Technical Implementation

### Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/sales-coach/index.ts` | Main agentic function (rebuild) |
| Database migration | New tables with RLS |

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/sales/SalesCoachChat.tsx` | Action toasts with undo, email display, research cards |
| `src/components/sales/SalesChatInterface.tsx` | Same enhancements for trainer view |
| `src/pages/SalesTrainer.tsx` | Undo handling, new conversation starters |
| `supabase/config.toml` | Add sales-coach function config |

### Edge Function Structure

```typescript
// sales-coach/index.ts structure

interface SalesCoachRequest {
  message: string;
  conversationHistory?: string;
  userContext?: string;
  chatMode?: 'coach' | 'rec';
  deal?: any;
  viewAsCompanyId?: string;
  viewAsUserId?: string;
  undoAction?: string; // Undo token
}

interface SalesCoachResponse {
  message: string;
  actions: {
    type: string;
    entityId: string;
    undoToken: string;
    success: boolean;
    details: any;
  }[];
  dealCreated?: boolean;
  companyCreated?: { id: string; name: string };
  contactsCreated?: { id: string; name: string }[];
  emailDrafted?: { id: string; subject: string; preview: string };
  researchCompleted?: { company: string; summary: string };
  pipelineActions?: any[];
}
```

---

## Implementation Sequence

### Phase 1: Rebuild sales-coach with Autonomous CRM
1. Create database migration for new tables
2. Rebuild `sales-coach` edge function from scratch
3. Implement intent detection layer (Gemini Flash-Lite)
4. Add entity extraction and creation logic
5. Implement undo mechanism
6. Add action logging
7. Update frontend with action toasts and undo buttons

### Phase 2: Research Integration
1. Wire up `research-prospects` function call from sales-coach
2. Store research results in `sales_company_intelligence`
3. Add research trigger detection
4. Display research results in chat

### Phase 3: Email Drafting
1. Create `email_drafts` table
2. Add email intent detection
3. Build email generation prompts with personalization
4. Integrate current events from Perplexity
5. Add email display in chat UI

### Phase 4: Continuous Learning
1. Enhance insight extraction post-conversation
2. Build intelligence synthesis (consolidate insights into profiles)
3. Implement feedback loop injection into prompts
4. Add pattern detection

---

## What Makes This Production-Ready

| Concern | Solution |
|---------|----------|
| **Accidental creates** | 5-second undo window with toast |
| **Ambiguous names** | Best guess + "let me know if wrong" |
| **API failures** | Graceful degradation with user-friendly messages |
| **Duplicates** | Case-insensitive fuzzy matching |
| **Data loss** | Soft deletes, action logging |
| **Slow responses** | Timeout protection, partial results |
| **Super admin impersonation** | Full support for viewAsUserId/viewAsCompanyId |
| **RLS compliance** | All queries use authenticated Supabase client |

---

## Success Metrics

After implementation, Jericho will:
- Auto-create 80%+ of new companies/contacts mentioned in conversation
- Build intelligence profiles for all active accounts
- Draft personalized emails that need minimal editing
- Surface actionable insights from every conversation
- Reduce CRM data entry time to near-zero
- Handle customer demos without embarrassing failures
