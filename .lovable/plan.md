

## Plan: Multi-Channel Daily Brief Delivery (Telegram + SMS)

### Current State

The daily brief system already exists as an AI-generated personalized email (`send-daily-brief-email`) orchestrated by `process-daily-brief-queue`. It gathers rich user context (tasks, goals, habits, capabilities, streaks) and uses the Lovable AI gateway to write a ~300-word coaching email. The content generation logic is solid but tightly coupled to email/HTML output.

Telegram infrastructure is also in place: `telegram_links` table stores chat IDs, `telegram-webhook` handles inbound messages, and `telegram-send-scheduled` dispatches outbound messages.

Twilio SMS infrastructure exists too: `send-sms` and `receive-sms` edge functions are deployed with credentials configured.

### What Needs to Change

**1. Extract a shared "generate daily brief content" function**

Refactor the context-gathering and AI prompt logic out of `send-daily-brief-email` into a new shared module (`supabase/functions/_shared/daily-brief-content.ts`). This module:
- Fetches all user context (tasks, goals, habits, capabilities, streaks, vision)
- Calls the AI gateway with a format parameter (`html` for email, `markdown` for Telegram, `plain` for SMS)
- Returns structured content: `{ subject, body, shortSummary }` where `shortSummary` is a ~160-char SMS-friendly version

**2. Create `send-daily-brief-telegram` edge function**

- Looks up user's `telegram_links` record for their `telegram_chat_id`
- Calls the shared content generator with `format: 'markdown'`
- Sends via Telegram Bot API (`sendMessage` with Markdown parse mode)
- Logs delivery in `email_deliveries` (or a new `brief_deliveries` table) with `channel = 'telegram'`

**3. Create `send-daily-brief-sms` edge function**

- Looks up user's phone from `profiles` where `sms_opted_in = true`
- Calls the shared content generator with `format: 'plain'`
- Uses the `shortSummary` (~160 chars) + a link to the full brief in-app
- Invokes existing `send-sms` function or calls Twilio directly
- Logs delivery with `channel = 'sms'`

**4. Update `process-daily-brief-queue` orchestrator**

- After generating the podcast and sending email, also:
  - Check if user has an active `telegram_links` record → invoke `send-daily-brief-telegram`
  - Check if user has `sms_opted_in = true` + valid phone → invoke `send-daily-brief-sms`
- Respect user channel preferences (new columns or use existing `email_preferences` table)

**5. Database changes**

- Add `delivery_channels` column to `email_preferences` table (jsonb, default `{"email": true, "telegram": false, "sms": false}`) so users can pick which channels they receive briefs on
- Add a `channel` column to `email_deliveries` table (text, default `'email'`) to track multi-channel delivery

**6. Settings UI update**

- On the Settings page, under the "Daily Brief Email" card, add toggles for:
  - Email (existing, on by default)
  - Telegram (enabled only if user has linked Telegram)
  - SMS (enabled only if user has opted in to SMS)

### OpenClaw / Agent Integration

The OpenClaw Jericho Operations Agent already polls `agent_tasks` for pending work. To have it orchestrate daily briefs:
- The cron job creates `agent_tasks` entries with `task_type = 'daily_brief'` for each eligible user
- Jericho agent picks them up, calls the appropriate delivery functions
- This replaces the direct function-to-function invocation in `process-daily-brief-queue`, making it agent-driven

This is optional and can be added incrementally after the core multi-channel delivery works.

### Technical Details

- Telegram messages use Markdown formatting with inline buttons ("Open Full Brief" linking to `/dashboard/my-growth-plan`)
- SMS messages are capped at 160 chars: a one-line summary + shortened app URL
- The AI prompt includes a `format` instruction so it generates appropriate output per channel
- All three channels share the same context-gathering code, avoiding duplication
- Edge functions: `send-daily-brief-telegram` and `send-daily-brief-sms` both set `verify_jwt = false` (called server-to-server)

