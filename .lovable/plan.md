# Upgrade Telegram Bot to Full Jericho Intelligence

## Status: ✅ IMPLEMENTED

### 1. Database Migration ✅
- Added `telegram_update_id` (bigint, nullable) to `telegram_conversations`
- Added index on `telegram_update_id` for duplicate detection
- Added index on `(user_id, created_at DESC)` for fast conversation history

### 2. Sales Coach Auth Bypass ✅
- Added 8-line internal service call detection in `sales-coach/index.ts` (after auth block)
- When token matches service role key and `viewAsUserId` is provided, trusts the IDs directly

### 3. AI Router ✅
- Added `'telegram-chat'` task type routed to `'gemini-pro'`

### 4. Telegram Webhook Rewrite ✅
- **Sales-coach proxy**: All sales/general/unclear messages route through sales-coach via internal fetch
- **Growth path**: Growth/capabilities/training/sprint queries use Gemini Pro via ai-router
- **Kudos shortcut**: Direct DB insert into recognitions table
- **Conversation history**: Last 10 messages within 24hrs by user_id
- **Edit-message UX**: "Thinking..." replaced via editMessageText
- **Duplicate prevention**: update_id checked before processing
- **Manager context**: Loads team data for manager users
- **Error handling**: 45s timeout, graceful fallbacks, all paths return 200
- **Response formatting**: Strips unsupported markdown, appends action confirmations, truncates at 4000 chars

---

# Multi-Channel Daily Brief Delivery (Telegram + SMS)

## Status: ✅ IMPLEMENTED

### What was done

#### 1. Database Migration ✅
- Added `delivery_channels` (jsonb, default `{"email": true, "telegram": false, "sms": false}`) to `email_preferences`
- Added `channel` (text, default `'email'`) to `email_deliveries`

#### 2. Shared Content Generator ✅
- Created `supabase/functions/_shared/daily-brief-content.ts`
- Exports `gatherUserContext()` — parallel DB queries for habits, goals, capabilities, tasks, streaks, vision
- Exports `generateBriefContent()` — AI-powered brief in `html`, `markdown`, or `plain` format
- Returns `{ subject, body, shortSummary }` where shortSummary is ~160 chars for SMS

#### 3. Telegram Delivery Function ✅
- Created `supabase/functions/send-daily-brief-telegram/index.ts`
- Looks up `telegram_links.telegram_chat_id`
- Sends Markdown-formatted brief with inline keyboard buttons
- Automatic plain text fallback on Markdown parse errors
- Logs delivery with `channel = 'telegram'`

#### 4. SMS Delivery Function ✅
- Created `supabase/functions/send-daily-brief-sms/index.ts`
- Checks `sms_opted_in` and phone number on profile
- Sends `shortSummary` via existing `send-sms` function (Twilio)
- Logs delivery with `channel = 'sms'`

#### 5. Orchestrator Updated ✅
- `process-daily-brief-queue` now reads `delivery_channels` from `email_preferences`
- Dispatches to email, telegram, and/or SMS based on user preferences
- Each channel handled independently with error isolation

#### 6. Settings UI Updated ✅
- Added Delivery Channels section under Daily Brief Email card
- Three toggles: Email, Telegram, SMS
- Telegram toggle disabled if no `telegram_links` record
- SMS toggle disabled if user hasn't opted in with a phone number
- Both check real DB state on load

### Future enhancements
- OpenClaw Jericho agent orchestration via `agent_tasks` table
- Per-channel delivery time preferences
- Brief content caching to avoid regenerating for multiple channels
