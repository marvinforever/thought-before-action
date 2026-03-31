

# Fix the Daily Brief Email Quality

## Problem

The `send-daily-brief-email` edge function has its **own AI prompt** (line 102) that is completely separate from the improved shared module `_shared/daily-brief-content.ts`. The email prompt is:
- Cheerleader-ish ("encouraging but not cheesy" — it still is)
- Celebrates meaningless metrics (1-day streaks, 2-day login streaks)
- Dumps raw task lists including irrelevant personal items (Frost Law tax prep)
- Generic capability coaching
- Missing evidence-based progress tracking
- Duplicates all data fetching instead of using `gatherUserContext()`

Meanwhile, `daily-brief-content.ts` already has the better "trusted advisor" prompt with evidence-based reporting, honest progress checks, and playbook-specific coaching — but the email function **never calls it**.

## Plan

### 1. Refactor `send-daily-brief-email/index.ts` to use the shared module

- Remove the duplicate `generatePersonalizedEmail()` function and its old prompt (~180 lines)
- Remove duplicate data fetching (profiles, episodes, habits, targets, capabilities, calendar, playbook — all already handled by `gatherUserContext()`)
- Import and call `gatherUserContext()` and `generateBriefContent()` from `_shared/daily-brief-content.ts`
- Keep only: welcome email logic, HTML template wrapping, Resend sending, delivery logging

### 2. Upgrade the shared prompt in `daily-brief-content.ts`

Tighten the system prompt to fix the specific issues shown in the sample email:

- **No celebrating trivial streaks**: Add rule: "A 1-2 day streak is not worth mentioning. Only highlight streaks of 5+ days."
- **Filter irrelevant tasks**: Add rule: "Only include tasks that are WORK-RELATED or growth-related. Skip obvious personal items (tax prep, medical, errands)."
- **No generic capability fluff**: Add rule: "When discussing a capability, reference a SPECIFIC action from their playbook coaching tips — never give a textbook definition of the capability."
- **Shorter, punchier**: Reduce target word count from 250-350 to 150-250 words. Cut the padding.
- **Quick Reflect must connect to something real**: Strengthen the rule — tie it to a specific playbook action or recent conversation, not just "how will X influence Y."

### 3. Deploy and test

- Deploy the updated edge function
- Trigger a test email to mark@themomentumcompany.com to verify the improved output

## Technical Details

**Files modified:**
- `supabase/functions/send-daily-brief-email/index.ts` — Major refactor: replace ~400 lines of duplicate logic with imports from shared module. Keep welcome email, HTML wrapper, Resend send, delivery logging.
- `supabase/functions/_shared/daily-brief-content.ts` — Tighten prompt rules for streak thresholds, task filtering, capability specificity, and brevity.

