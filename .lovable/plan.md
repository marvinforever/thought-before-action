

# Enhanced 4-Call Plan Email Reminder System

## Overview

Building on the original plan, this enhanced version pulls **all available customer intelligence** into each coaching email, making Jericho a true sales guru with real-time context.

---

## Complete Data Sources for Each Email

The reminder system will aggregate data from **7 different tables** to build the most informed coaching possible:

| Data Source | Table | What It Provides |
|-------------|-------|------------------|
| **Purchase History** | `customer_purchase_history` | 2025 revenue, products, quantities, bonus categories |
| **4-Call Tracker** | `call_plan_tracking` | Prior call notes (1-3), precall_plan, acreage, crops, dates |
| **CRM Company** | `sales_companies` | grower_history, operation_details, customer_since, notes |
| **Pipeline Deals** | `sales_deals` | Active deals, stage, value, expected close, notes |
| **Sales Activities** | `sales_activities` | Recent calls/emails, outcomes, activity notes |
| **Customer Documents** | `customer_documents` | Uploaded docs, summaries, extracted insights |
| **Sales Contacts** | `sales_contacts` | Contact names, decision makers, contact-level notes |

---

## Data Aggregation Flow

```text
┌─────────────────────────────────────────────────────────────────────┐
│              CUSTOMER INTELLIGENCE AGGREGATION                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Input: customer_name from call_plan_tracking                      │
│                                                                     │
│   ┌────────────────────────────────────────────────────────────┐    │
│   │  Step 1: Fuzzy Match to Find Customer Entities             │    │
│   │                                                            │    │
│   │  call_plan_tracking.customer_name                          │    │
│   │       ↓ fuzzy match (ILIKE)                                │    │
│   │  sales_companies.name → get company_id                     │    │
│   │  customer_purchase_history.customer_name                   │    │
│   └────────────────────────────────────────────────────────────┘    │
│                         │                                           │
│                         ▼                                           │
│   ┌────────────────────────────────────────────────────────────┐    │
│   │  Step 2: Gather All Related Data                           │    │
│   │                                                            │    │
│   │  ├── sales_companies (grower_history, operation_details)   │    │
│   │  ├── sales_deals (active deals for this customer)          │    │
│   │  ├── sales_activities (recent touchpoints)                 │    │
│   │  ├── sales_contacts (contacts & notes)                     │    │
│   │  ├── customer_documents (docs & summaries)                 │    │
│   │  └── customer_purchase_history (2025 + prior years)        │    │
│   └────────────────────────────────────────────────────────────┘    │
│                         │                                           │
│                         ▼                                           │
│   ┌────────────────────────────────────────────────────────────┐    │
│   │  Step 3: Compile Context for AI                            │    │
│   │                                                            │    │
│   │  - Aggregate into structured JSON                          │    │
│   │  - Include all prior call notes from tracker               │    │
│   │  - Recent activity timeline (last 30 days)                 │    │
│   │  - Product purchase patterns (YoY comparison)              │    │
│   │  - Open deal status and pipeline position                  │    │
│   └────────────────────────────────────────────────────────────┘    │
│                         │                                           │
│                         ▼                                           │
│   ┌────────────────────────────────────────────────────────────┐    │
│   │  Step 4: Generate Stage-Specific Coaching                  │    │
│   │                                                            │    │
│   │  AI receives complete customer context + call stage        │    │
│   │  Outputs personalized coaching email                       │    │
│   └────────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Enhanced Email Content

Each email will now include contextual sections based on available data:

```text
Subject: [7-Day Reminder] Pre-Plant Check-in with JOHNSON FARMS - Feb 15

Hey Mike,

Your PRE-PLANT CHECK-IN with JOHNSON FARMS is coming up on Saturday, February 15th.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 CUSTOMER SNAPSHOT
• 2025 Revenue: $47,250 (up 12% from 2024)
• Operation: 1,200 acres - Corn/Soybean rotation
• Customer Since: 2019
• Key Quote: "We're always looking to increase yields on the back 40"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 FROM YOUR PREPAY REVIEW (Call 1 - Jan 8)
You noted: "They're interested in trying the new fungicide this season.
Wife mentioned drainage issues in the north field."

Your precall plan mentioned pushing the premium seed treatment.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📞 RECENT ACTIVITY
• Jan 22: Email sent about prepay deadline extension
• Jan 15: Phone call - discussed fertilizer timing

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 PRODUCTS TO DISCUSS
Based on their 2024 purchases and what they DIDN'T buy:
• ✅ They bought: Liberty herbicide (12 gal) - confirm same volume
• ⚠️ Opportunity: No fungicide last year - they mentioned interest!
• ⚠️ Opportunity: Seed treatment upgrade - 40% of similar ops use this

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 COACHING FOR PRE-PLANT CHECK-IN

1. **Confirm timing**: When are they planning to start planting? Weather looks...
2. **Follow up on fungicide interest**: "Last time you mentioned wanting to try..."
3. **Address the drainage concern**: Their wife mentioned north field issues...
4. **Application planning**: Do they need custom application scheduling?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 QUESTIONS TO ASK
• "How did the seed treatment perform last season?"
• "Any changes to your planting plan with the wet forecast?"
• "Did you end up addressing that drainage in the north field?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You've got this. Go make an impact! 🌾

— Jericho
```

---

## "Recently Updated" Logic

The system will flag **recently changed data** so the rep knows what's new:

| Data Type | "Recent" Definition | Flag Text |
|-----------|---------------------|-----------|
| Call Notes | Updated in last 7 days | "📝 Updated [X days ago]" |
| CRM Notes | Updated in last 14 days | "🆕 New note added" |
| Activities | Created in last 7 days | Full activity included |
| Documents | Uploaded in last 30 days | "📄 New document: [title]" |
| Deals | Stage changed in 7 days | "📊 Deal moved to [stage]" |

---

## Implementation Steps

### Step 1: Database Migration

Create `call_plan_reminders` table:

```sql
CREATE TABLE public.call_plan_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  call_plan_tracking_id UUID REFERENCES call_plan_tracking(id) ON DELETE CASCADE NOT NULL,
  call_number INTEGER NOT NULL CHECK (call_number BETWEEN 1 AND 4),
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('7_day', '1_day')),
  customer_name TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  subject TEXT,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Prevent duplicate reminders
  UNIQUE(call_plan_tracking_id, call_number, reminder_type)
);

-- RLS: users see only their own reminders
ALTER TABLE public.call_plan_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reminders"
ON public.call_plan_reminders
FOR SELECT USING (profile_id = auth.uid());
```

### Step 2: Edge Function - `send-call-plan-reminder`

This function does the heavy lifting:

1. **Input**: `profile_id`, `call_tracking_id`, `call_number`, `reminder_type`

2. **Customer Matching**:
   - Query `sales_companies` with fuzzy match on customer_name
   - Query `customer_purchase_history` for 2024 + 2025 data

3. **Data Aggregation**:
   - Fetch `call_plan_tracking` record (all notes, dates, precall_plan)
   - Fetch matched `sales_companies` (grower_history, operation_details, notes)
   - Fetch `sales_deals` WHERE name ILIKE customer_name
   - Fetch `sales_activities` from those deals (last 30 days)
   - Fetch `sales_contacts` linked to matched company
   - Fetch `customer_documents` (recent uploads, summaries)

4. **AI Generation**:
   - Call Lovable AI with stage-specific system prompt
   - Include complete customer context JSON
   - Generate HTML email with coaching

5. **Send & Log**:
   - Send via Resend
   - Insert into `call_plan_reminders` to prevent duplicates

### Step 3: Edge Function - `process-call-plan-reminders`

Daily cron job (7 AM CST):

1. Query `call_plan_tracking` for:
   - `call_X_date = CURRENT_DATE + 7` (7-day reminder)
   - `call_X_date = CURRENT_DATE + 1` (1-day reminder)
   - `call_X_completed = false`
   - Profile belongs to Stateline Cooperative

2. For each match:
   - Check `call_plan_reminders` for existing record
   - Skip if already sent
   - Invoke `send-call-plan-reminder`

3. Error handling with retries and logging

### Step 4: Cron Job Setup

```sql
SELECT cron.schedule(
  'call-plan-reminders-daily',
  '0 13 * * *',  -- 7 AM CST = 13:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://aiihzjkspwsriktvrdle.supabase.co/functions/v1/process-call-plan-reminders',
    headers := '{"Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb
  )
  $$
);
```

---

## Technical Details

### Customer Matching Strategy

Since `call_plan_tracking.customer_name` may not directly link to `sales_companies.id`, we use fuzzy matching:

```typescript
// Normalize names for matching
const normalizedName = customerName.toUpperCase().replace(/[,\s]+/g, ' ').trim();

// Try exact match first
const { data: exactMatch } = await supabase
  .from('sales_companies')
  .select('*')
  .eq('profile_id', profileId)
  .ilike('name', customerName)
  .single();

// Fallback to fuzzy match
if (!exactMatch) {
  const { data: fuzzyMatches } = await supabase
    .from('sales_companies')
    .select('*')
    .eq('profile_id', profileId)
    .or(`name.ilike.%${normalizedName.split(' ')[0]}%`);
}
```

### Stage-Specific AI Prompts

| Call | System Prompt Focus |
|------|---------------------|
| **1 - Prepay Review** | Pre-season planning, prepay programs, review last year, new opportunities |
| **2 - Pre-Plant** | Timing decisions, final inputs, weather considerations, application scheduling |
| **3 - Season Review** | Crop health check, in-season products, problem solving, yield outlook |
| **4 - Strategic Recs** | Post-harvest recap, next year planning, loyalty programs, relationship building |

### Security

- RLS on `call_plan_reminders` restricts to own records
- Edge function uses service role for cross-table queries
- Stateline-only filter: `company_id = 'd32f9a18-aba5-4836-aa66-1834b8cb8edd'`

---

## Summary

This system transforms Jericho from a reminder tool into a **true sales intelligence assistant** that:

1. Knows when you have customer meetings scheduled
2. Aggregates ALL available data about that customer
3. Highlights recently updated information so you know what's new
4. Provides stage-appropriate coaching based on real data
5. Remembers your prior notes and plans from earlier calls
6. Sends proactive 7-day and 1-day reminders

The result: Reps walk into every meeting with complete context and data-driven talking points.

