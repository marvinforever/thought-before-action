

# Sales Manager Reporting Dashboard

## Overview

Build a comprehensive reporting dashboard that allows sales managers to monitor their direct reports' Sales Agent activity, 4-Call Tracker progress, pipeline health, and AI coaching engagement.

## Access Control

| User Type | Access Level |
|-----------|-------------|
| Super Admin | Can view any company's dashboard via existing "View As" selector |
| Manager (with role in `user_roles`) | Can view dashboard for their assigned direct reports via `manager_assignments` |
| Regular User | No access to this dashboard |

---

## Features to Implement

### 1. Team Activity Overview (Summary Cards)

Quick-glance metrics at the top of the dashboard:

- **Active Sellers**: Count of direct reports with recent activity
- **Total Pipeline Value**: Sum of `sales_deals.value` across all direct reports
- **Avg 4-Call Completion**: Percentage of completed calls across all growers
- **AI Coaching Sessions**: Count of `sales_coach_conversations` in last 30 days
- **Last Activity**: Most recent activity timestamp across the team

### 2. 4-Call Tracker Progress Report

A table showing each rep's 4-Call Plan progress:

| Rep Name | Customers Tracked | Call 1 % | Call 2 % | Call 3 % | Call 4 % | Overall % |
|----------|------------------|----------|----------|----------|----------|-----------|

Expandable rows to show individual customer-level progress with ability to drill into notes.

### 3. Pipeline Health by Rep

Per-rep breakdown of their deal pipeline:

- Deals by stage (stacked bar chart)
- Total value per rep (horizontal bar chart)
- Average deal age in current stage
- Stale deals alert (deals with no activity in 14+ days)

### 4. AI Coaching Engagement Leaderboard

Ranking of reps by their Sales Agent usage:

- Number of coaching conversations
- Total messages exchanged
- Average conversation length
- Most recent coaching session date
- Conversation topics (extracted from titles)

### 5. Rep Detail Drill-Down

Clicking on any rep opens a detailed view:

- Their full 4-Call Tracker (read-only view)
- Their pipeline (read-only)
- Recent coaching conversation summaries
- Activity timeline (calls, meetings, notes)

---

## Technical Implementation

### New Database Views (No Schema Changes Needed)

All data exists in current tables. We'll create efficient queries using:

- `manager_assignments` → get employee_ids for current manager
- `call_plan_tracking` → 4-Call progress data
- `sales_deals` → Pipeline data
- `sales_coach_conversations` + `sales_coach_messages` → AI engagement
- `sales_activities` → Activity timeline

### New Files to Create

```text
src/components/sales/
├── SalesManagerDashboard.tsx       # Main dashboard component
├── SalesTeamOverviewCards.tsx      # Summary metric cards
├── FourCallProgressTable.tsx       # Team 4-Call tracker table
├── PipelineHealthChart.tsx         # Rep pipeline visualization
├── CoachingEngagementTable.tsx     # AI usage leaderboard
└── RepDetailDialog.tsx             # Drill-down dialog for individual rep
```

### Route & Navigation

Add new route accessible from Sales Trainer header:
- Route: `/sales-trainer/manager` or dialog within existing page
- Entry point: Button in `SalesAgentHeader.tsx` visible only to managers

### Access Control Implementation

```text
1. Check if user has 'manager', 'admin', or 'super_admin' role via has_role() RPC
2. If super admin: show company/user selector (existing)
3. If manager: fetch direct reports via manager_assignments
4. Query all sales data filtering by direct report profile_ids
```

### RLS Policy Updates

The existing RLS policies already support super admin bypass via `is_super_admin()`. For managers viewing their direct reports' data, we have two options:

**Option A**: Create database functions that return data for manager's reports (SECURITY DEFINER)
**Option B**: Query via edge function that validates manager relationship server-side

Recommendation: Option B (edge function) for flexibility and clearer audit trail.

### New Edge Function

```text
supabase/functions/get-sales-team-report/index.ts

- Validates caller is manager of the requested employees
- Returns aggregated data for:
  - 4-Call completion rates
  - Pipeline summary by rep
  - Coaching engagement metrics
- Prevents unauthorized access to other teams' data
```

---

## UI Design

### Dashboard Layout

```text
┌─────────────────────────────────────────────────────────────┐
│ Sales Team Dashboard                        [Refresh] [Print]│
├─────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│ │ Active   │ │ Pipeline │ │ 4-Call   │ │ Coaching │         │
│ │ Sellers  │ │ Value    │ │ Complete │ │ Sessions │         │
│ │    5     │ │  $1.2M   │ │   67%    │ │    23    │         │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
├─────────────────────────────────────────────────────────────┤
│ [4-Call Progress] [Pipeline Health] [Coaching] [Activity]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Tab Content (selected tab renders here)                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Color Coding

- Green: On track / Completed calls
- Yellow: Needs attention / Overdue
- Red: At risk / No recent activity

---

## Implementation Steps

1. **Create edge function** `get-sales-team-report` to securely fetch aggregated team data
2. **Build SalesManagerDashboard.tsx** - main container with tabs and overview cards
3. **Build FourCallProgressTable.tsx** - table showing per-rep 4-Call completion
4. **Build PipelineHealthChart.tsx** - charts for deal distribution by rep/stage
5. **Build CoachingEngagementTable.tsx** - leaderboard of AI coaching usage
6. **Build RepDetailDialog.tsx** - drill-down view for individual rep details
7. **Add manager access button** to SalesAgentHeader (visible to managers/admins)
8. **Add route/dialog trigger** for accessing the dashboard
9. **Test with Stateline manager** role to verify filtering works correctly

---

## Security Considerations

- Edge function validates manager relationship before returning any data
- No direct database access for cross-team data
- Super admin bypass uses existing `is_super_admin()` check
- All queries filter by `profile_id IN (direct_report_ids)`

