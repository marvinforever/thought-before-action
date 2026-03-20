

# Channel-First Post-Playbook Onboarding

## What We're Building

After the `/try` playbook is generated, instead of sending a password-based welcome email that leads to dead login links, we ask the user how they want to continue with Jericho — via **email reply**, **SMS/text**, or **web app (magic link)**. Then the welcome email matches their choice: no passwords, no dead links.

## Current State

- `try-jericho-onboard` creates a user with an auto-generated password, then sends a welcome email with that password and a "Log In →" button pointing to `/auth`
- Users don't know this password — the login link is effectively dead
- `signInWithOtp` (magic link) already exists in the codebase (used in PartnerRegister)
- `receive-email-reply` and `receive-sms` edge functions already exist for channel-based interaction
- No `channel_preference` field exists anywhere yet

## Plan

### Step 1: Add channel preference to the `/try` frontend flow

**File: `src/pages/TryJericho.tsx`**

After the playbook generation completes (the `GENERATION` status event), show a channel selection step instead of just "Your playbook has been emailed." Display three options:

- **📱 Text me** — "Get daily coaching via text message"
- **📧 Email reply** — "Reply to Jericho's emails to keep coaching"
- **💻 Web app** — "Access the full dashboard with a magic link"

When the user picks one, send it to `try-jericho-onboard` as `channelPreference`.

### Step 2: Store channel preference

**File: `supabase/functions/try-jericho-onboard/index.ts`**

- Accept `channelPreference` from the request body (values: `sms`, `email`, `web`)
- Save it to `user_active_context.onboarding_data` alongside existing diagnostic data
- If `sms`, also save phone number (already accepted in the request as `phone`)

### Step 3: Replace password welcome email with channel-appropriate email

**File: `supabase/functions/try-jericho-onboard/index.ts`**

Replace the current password-based welcome email (lines 242-313) with three variants:

**If `web`**: Send a magic link email using Supabase `signInWithOtp` — the email contains a one-click login button, no password needed.

**If `email`**: Send a "reply to get started" email — the email says "Just reply to this email anytime you want to chat with Jericho" with a `Reply-To: jericho@sender.askjericho.com` header. Include a secondary "View your dashboard" magic link.

**If `sms`**: Send a confirmation text via `send-sms` saying "Hey [Name], it's Jericho. Text me anytime for coaching. Your playbook is in your inbox." Also send a shorter email with the playbook link + magic link (no password).

**Default** (no preference selected): Send magic link email (same as `web`).

### Step 4: Database migration — add channel preference column

Add `preferred_channel` column to `profiles` table:

```sql
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferred_channel text 
DEFAULT 'web' 
CHECK (preferred_channel IN ('sms', 'email', 'web'));
```

This lets the daily brief system and Jericho chat route messages through the right channel.

### Files Changed

| File | Change |
|------|--------|
| `src/pages/TryJericho.tsx` | Add channel selection UI after playbook generation |
| `supabase/functions/try-jericho-onboard/index.ts` | Accept `channelPreference`, replace password email with channel-specific emails using magic links |
| New migration | Add `preferred_channel` column to `profiles` |

### What This Unlocks

- Zero-password onboarding — no more dead login links
- Users who prefer SMS never need to visit the web app
- Email repliers get a conversational flow immediately
- Web users get a magic link that logs them in with one click
- Daily brief system can route to the right channel based on `preferred_channel`

