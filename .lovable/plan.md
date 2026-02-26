

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

---

# Phase 1 + Phase 5: Personality Overhaul + Database Migration

## Status: ✅ IMPLEMENTED

### Phase 5: Database Migration ✅
- Created `telegram_outreach_preferences` table (user_id PK, proactive_enabled, max_daily_messages, quiet_hours, consecutive_ignored, preferred_response_format)
- Created `telegram_outreach_log` table (trigger_type, message_text, was_engaged)
- RLS: users manage own prefs, users read own outreach log

### Phase 1A: jericho-config.ts ✅
- Added `JERICHO_PERSONALITY` — unified voice/behavior for ALL AI calls
- Added `TELEGRAM_ADDENDUM` — mobile formatting rules for Telegram only
- Added `SALES_INTELLIGENCE_FRAMEWORK` — full multi-methodology framework (SPIN, Challenger, MEDDIC, Sandler, Gap Selling, Integrity Selling, Miller Heiman, Objection Handling, Negotiation, Ag Intelligence, Agronomic Product Intelligence)
- Deprecated old `COACHING_PHILOSOPHY`, `COACHING_STYLE`, `MISSING_PLAN_GUIDANCE` (kept for backward compat)

### Phase 1B: sales-coach/index.ts ✅
- Imported `JERICHO_PERSONALITY` and `SALES_INTELLIGENCE_FRAMEWORK`
- Deleted `methodologyReference` constant (replaced by framework)
- Rec mode: personality + framework + data-first override
- Coach mode: personality + framework + agentic action suggestions (→ format)

### Phase 1C: chat-with-jericho/index.ts ✅
- Imported `JERICHO_PERSONALITY`
- Replaced philosophy + style blocks with personality
- Kept role context (career coach mission, manager context, tools)
- Kept missing benchmarks guidance
- Did NOT inject sales framework (growth coaching only)

### Phase 1D: telegram-webhook/index.ts ✅
- Imported `JERICHO_PERSONALITY` and `TELEGRAM_ADDENDUM`
- Growth path: personality + addendum + user context
- Sales path: addendum flows through sales-coach proxy
- Upgraded onboarding message with richer welcome
- Auto-creates `telegram_outreach_preferences` row on account linking

### Notes for future phases
- `was_engaged` in outreach_log needs engagement tracking logic (check user reply within 5 min of outreach)
- Habit completion detection needs state tracking (last_prompt_type flag)
- consecutive_ignored >= 10 should drop to weekly outreach
- Confirm pg_cron availability for outreach scheduling
