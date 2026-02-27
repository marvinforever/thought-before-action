

# Jericho Master Execution — Phase 1 (Ship Today, Feb 27)

This plan covers the 4 priorities from your master doc. Priorities 1 and 2 are **already mostly done** from previous work. Here's what's left and what's new.

---

## Current State Assessment

| Priority | Status | What's Left |
|---|---|---|
| P1: Growth/Performance Data | ~90% done | Context loading is already rich. Missing: `individual_growth_plans` table doesn't exist — goals live in `ninety_day_targets`. No `industry` column on profiles yet. |
| P2: Personality + Sales Intelligence | ~95% done | `JERICHO_PERSONALITY`, `TELEGRAM_ADDENDUM`, `SALES_INTELLIGENCE_FRAMEWORK` already exist and are injected. Need: split ag content into `AGRICULTURE_INTELLIGENCE`, add industry-conditional injection, update personality per new spec wording. |
| P3: Seed Test Data | 0% done | Need to insert seed data for your account via SQL. |
| P4: Onboarding Flexibility + Goal Lifecycle | 0% done | Need DB migration for goal lifecycle fields + bot skip-path logic. |

---

## Implementation Steps

### Step 1: Database Migration — `profiles.industry` + goal lifecycle fields

Add `industry` column to `profiles`:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS industry text DEFAULT null;
```

Add goal lifecycle fields to `ninety_day_targets` (this is where goals live — there is no `individual_growth_plans` table):
```sql
ALTER TABLE ninety_day_targets 
  ADD COLUMN IF NOT EXISTS goal_status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS goal_cycle text,
  ADD COLUMN IF NOT EXISTS goal_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS goal_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS goal_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_roll_enabled boolean DEFAULT true;
```

Backfill existing goals:
```sql
UPDATE ninety_day_targets 
SET goal_status = 'active', 
    goal_set_at = created_at,
    goal_reviewed_at = updated_at,
    auto_roll_enabled = true
WHERE goal_status IS NULL;
```

### Step 2: Update `jericho-config.ts` — Split Ag Intelligence, Update Personality

- **Update `JERICHO_PERSONALITY`**: Replace current text with the new spec wording (adds "Coaching-oriented: Ask questions before giving answers", "Mirror their world" industry terminology rule, and the `→` action format instruction).
- **Update `TELEGRAM_ADDENDUM`**: Add "Voice notes are welcome" and "Offer inline keyboard buttons" lines from spec.
- **Extract `AGRICULTURE_INTELLIGENCE`**: Move the "AG-SPECIFIC SELLING INTELLIGENCE" and "AGRONOMIC PRODUCT INTELLIGENCE" sections (lines 381-476) out of `SALES_INTELLIGENCE_FRAMEWORK` into a new exported constant `AGRICULTURE_INTELLIGENCE`.
- **`SALES_INTELLIGENCE_FRAMEWORK`** retains all universal methodologies (SPIN through Negotiation Principles, plus the "HOW TO APPLY" and "WHAT YOU NEVER DO" sections).

### Step 3: Update `sales-coach/index.ts` — Industry-Conditional Injection

- Import `AGRICULTURE_INTELLIGENCE` from jericho-config.
- In `gatherContext`, fetch `profile.industry` (already fetched via profile query).
- In `generateResponse`, after `SALES_INTELLIGENCE_FRAMEWORK`, conditionally append:
  ```
  ${profile?.industry === 'agriculture' ? AGRICULTURE_INTELLIGENCE : ''}
  ```
- This pattern supports future industry constants.

### Step 4: Update `telegram-webhook/index.ts` — Industry-Conditional + Goal Lifecycle Context

- Import `AGRICULTURE_INTELLIGENCE`.
- In `loadJerichoContext`, add `profile.industry` to the context string.
- For sales-path messages, conditionally inject ag intelligence when `profile.industry === 'agriculture'`.
- Add goal lifecycle fields to the 90-day targets context display (show `goal_status`, `goal_expires_at`, `goal_cycle`).

### Step 5: Update `chat-with-jericho/index.ts` — No changes needed

Already uses `JERICHO_PERSONALITY`. Growth coaching doesn't need sales/ag intelligence. No action required.

### Step 6: Seed Test Data (via SQL insert tool)

This uses the data insert tool (NOT migration). Will insert:

1. **Profile update**: Set `industry = 'agriculture'` on your admin account.
2. **90-day targets** (3 goals with benchmarks + sprints as JSON):
   - Revenue: $340K target, 40% progress
   - New customer acquisition: 8 accounts, 38% progress
   - Capability focus: Consultative Selling Level 3
3. **Leading indicators** (3 daily habits):
   - Pre-call planning
   - 5 customer touches per day
   - End-of-day reflection
4. **Employee capabilities** (3 entries):
   - Consultative Selling: Level 2 → 3
   - Objection Handling: Level 1 → 2
   - Territory Planning: Level 2 → 3
5. **Sales companies** (5 customers with contacts)
6. **Sales deals** (3 pipeline deals)

Note: Need to identify your admin user ID to insert the seed data. Will query `profiles` where `is_admin = true` or `is_super_admin = true`.

### Step 7: Onboarding Flexibility (Telegram Skip Paths)

In `telegram-webhook/index.ts`, add skip-path detection to the growth coaching system prompt:

```
FLEXIBILITY PRINCIPLE:
If the user says "skip", "not sure", "later", "I don't know", "pass", 
or ignores a multi-step question — move forward with sensible defaults.
Push back ONCE with a friendly nudge. If they still resist, accept 
gracefully and move on. Never get stuck waiting for a "correct" answer.
```

This is a prompt-level instruction, not a code-level state machine. The AI handles it naturally.

---

## Deployment Order

1. Database migration (industry column + goal lifecycle fields)
2. Backfill existing goals via insert tool
3. `jericho-config.ts` updates (personality, ag split)
4. `sales-coach/index.ts` (industry-conditional injection)
5. `telegram-webhook/index.ts` (industry context + flexibility prompt)
6. Seed data insertion for your account

---

## Technical Details

- No new tables needed — `ninety_day_targets` already serves as the goal store.
- `individual_growth_plans` referenced in the master doc doesn't exist in this DB. All goal/target logic uses `ninety_day_targets`.
- The `AGRICULTURE_INTELLIGENCE` constant will be ~100 lines (extracted from current `SALES_INTELLIGENCE_FRAMEWORK` lines 381-476).
- `SALES_INTELLIGENCE_FRAMEWORK` drops to ~180 lines (universal methodologies only).
- Seed data requires knowing your user ID — will query for it during implementation.

