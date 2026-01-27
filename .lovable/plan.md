
# 4-Call Plan Tracker for Top Customers

## Overview

Create a visual scheduling and tracking feature in the Sales Agent that helps reps manage their 4-Call Plan execution for top-priority customers. This will include:

1. **A new "4-Call Tracker" tab/view** that shows the top 20% revenue customers (or any user-defined list)
2. **Visual checklist per customer** with the 4 call stages tracked
3. **Print-friendly layout** so reps can take it into the field
4. **Persistence** so progress is saved between sessions

---

## User Experience

### Accessing the Tracker

- Add a new tab or button in the Sales Agent interface: **"4-Call Tracker"**
- When clicked, it opens a dedicated view showing:
  - List of priority customers (defaults to Pareto top 20% from historical revenue)
  - Each customer has 4 checkboxes representing the call stages
  - Dates/notes per call (optional)
  - A "Print Checklist" button

### The Checklist View

Each customer row shows:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ JOHNSON, TIM                                           $182,450 lifetime   │
│ 1,200 acres | Corn/Beans | Current Customer                                │
├────────────────────────────────────────────────────────────────────────────┤
│ ☐ Call 1: Initial Planning     │ Date: _______ │ Notes: ____________      │
│ ☐ Call 2: Pre-Plant Check-in   │ Date: _______ │ Notes: ____________      │
│ ☐ Call 3: Season Review        │ Date: _______ │ Notes: ____________      │
│ ☐ Call 4: Strategic Recs       │ Date: _______ │ Notes: ____________      │
└────────────────────────────────────────────────────────────────────────────┘
```

### Filtering Options

- **Top 20% by Revenue** (default, uses Pareto analysis)
- **All Customers** 
- **Custom Selection** (manually pick which customers to track)
- **Filter by completion** (show only incomplete, show completed, show all)

### Print View

- Clean, black-and-white optimized layout
- One customer per "card" or row
- Checkboxes are printable squares
- Space for handwritten notes
- Date fields pre-filled or left blank

---

## Technical Implementation

### Database Changes

**New Table: `call_plan_tracking`**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| profile_id | uuid | The sales rep |
| customer_name | text | Customer being tracked |
| customer_id | uuid (nullable) | Link to sales_companies if exists |
| plan_year | integer | Year for this plan (e.g., 2025) |
| call_1_completed | boolean | Default false |
| call_1_date | date | When call 1 was made |
| call_1_notes | text | Notes from call 1 |
| call_2_completed | boolean | Default false |
| call_2_date | date | When call 2 was made |
| call_2_notes | text | Notes from call 2 |
| call_3_completed | boolean | Default false |
| call_3_date | date | When call 3 was made |
| call_3_notes | text | Notes from call 3 |
| call_4_completed | boolean | Default false |
| call_4_date | date | When call 4 was made |
| call_4_notes | text | Notes from call 4 |
| created_at | timestamptz | Created timestamp |
| updated_at | timestamptz | Last updated |

**RLS Policies:**
- Users can only read/write their own tracking records

### Frontend Components

**1. New Component: `FourCallPlanTracker.tsx`**

Main container component that:
- Fetches the user's top customers (via Pareto analysis or custom list)
- Fetches existing tracking data from `call_plan_tracking`
- Renders the `CustomerCallCard` for each customer
- Provides filter controls and print button

**2. New Component: `CustomerCallCard.tsx`**

Individual card for each customer showing:
- Customer name, revenue, metadata
- 4 checkboxes with date pickers
- Notes input for each call
- Auto-saves on change

**3. Print Stylesheet**

Add print-specific CSS to render a clean, professional checklist when printing:
- Hide navigation and chrome
- Black/white optimized
- Proper page breaks between customers

### Integration Points

**1. SalesChatInterface.tsx**
- Add a button: "📋 4-Call Tracker" that opens the tracker view

**2. Sales Agent Header**
- Could also add quick access here

**3. Jericho Integration (Optional)**
- Allow natural language: "Show me my 4-call tracker" or "How many calls have I completed this year?"
- Jericho could report on completion status

### Data Flow

```
User clicks "4-Call Tracker"
         │
         ▼
┌─────────────────────────────────────┐
│ Fetch top customers                 │
│ - Query customer_purchase_history   │
│ - Run Pareto analysis (top 20%)     │
│ - Or fetch user's saved list        │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Fetch tracking data                 │
│ - Query call_plan_tracking          │
│ - Match by customer_name + year     │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Render tracker UI                   │
│ - Customer cards with checkboxes    │
│ - Progress summary at top           │
│ - Print button                      │
└─────────────────────────────────────┘
         │
         ▼
User checks a box or adds a note
         │
         ▼
┌─────────────────────────────────────┐
│ Auto-save to call_plan_tracking     │
│ - Upsert the record                 │
│ - Update UI optimistically          │
└─────────────────────────────────────┘
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/components/sales/FourCallPlanTracker.tsx` | Create | Main tracker component |
| `src/components/sales/CustomerCallCard.tsx` | Create | Individual customer card |
| `src/components/sales/SalesChatInterface.tsx` | Modify | Add button to open tracker |
| `src/pages/SalesTrainer.tsx` | Modify | Add state and dialog for tracker |
| `src/index.css` | Modify | Add print styles |
| Database migration | Create | Add `call_plan_tracking` table |

---

## Print Layout Preview

When user clicks "Print Checklist":

```
╔══════════════════════════════════════════════════════════════╗
║         4-CALL PLAN TRACKER - ANDREW SMITH - 2025            ║
║              28 Priority Customers | 7 Completed             ║
╚══════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────┐
│ JOHNSON, TIM                                 Revenue: $182K  │
│ 1,200 ac | Corn & Beans                                      │
├──────────────────────────────────────────────────────────────┤
│ □ Call 1: Initial Planning        Date: _________            │
│   Notes: ________________________________________________    │
│                                                              │
│ □ Call 2: Pre-Plant Check-in      Date: _________            │
│   Notes: ________________________________________________    │
│                                                              │
│ □ Call 3: Season Review           Date: _________            │
│   Notes: ________________________________________________    │
│                                                              │
│ □ Call 4: Strategic Recs          Date: _________            │
│   Notes: ________________________________________________    │
└──────────────────────────────────────────────────────────────┘

[Page break between customers or 2-3 per page]
```

---

## Summary

This feature transforms the 4-Call Plan from an AI-generated suggestion into a persistent, trackable workflow:

1. **Auto-populates** with top 20% revenue customers (28 in Andrew's case)
2. **Tracks progress** through the 4 stages per customer
3. **Prints beautifully** for field use
4. **Syncs to database** so progress is never lost
5. **Integrates with Jericho** for status queries

The rep can see at a glance: "I've completed Call 1 with 12 customers, Call 2 with 8, and I'm behind on my Season Reviews."
