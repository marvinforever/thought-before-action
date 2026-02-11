

## Add "Skip Weekend Emails" Setting

### Overview
Add a toggle in Settings that lets users opt out of receiving Jericho emails on Saturdays and Sundays. This applies to both the Growth Email and Daily Brief systems.

### Changes

**1. Database Migration**
- Add a `skip_weekends` boolean column to `email_preferences` table (default: `false`)

**2. Settings UI (src/pages/Settings.tsx)**
- Add a new Switch toggle in the "Daily Brief Email" card (below the email enabled toggle) labeled **"Skip Weekend Emails"**
- Description: "Don't send emails on Saturday or Sunday"
- Only visible when email is enabled
- Saves via the existing `saveEmailPrefs()` function

**3. Edge Function: process-email-queue**
- After determining the user's local day of the week, check if `skip_weekends` is `true`
- If the local day is Saturday or Sunday and `skip_weekends` is enabled, skip that user

**4. Edge Function: process-daily-brief-queue**
- Add the same weekend check: determine the Eastern time day of week
- If it's Saturday or Sunday and the user has `skip_weekends` enabled, skip them
- This requires joining/fetching `email_preferences.skip_weekends` for each user

### Technical Details

- The `process-email-queue` function already calculates the user's local day (`currentDayInUserTz`) -- we just need to add a Saturday/Sunday check
- The `process-daily-brief-queue` function currently sends to all users in enabled companies; it will need to left-join `email_preferences` to check the `skip_weekends` flag
- The `emailPrefs` state in Settings.tsx will get a new `skip_weekends` field, persisted via the existing upsert logic

