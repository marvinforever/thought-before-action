

# Upgrade Telegram Bot to Full Jericho Intelligence

## Status: ✅ IMPLEMENTED

## What was done

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
