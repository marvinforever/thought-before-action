

# Upgrade Telegram Bot to Full Jericho Intelligence

## Overview

Rewrite the Telegram webhook to proxy messages through the existing `sales-coach` edge function for sales/general queries, use a stronger model for growth queries, and add conversation continuity, duplicate prevention, edit-message UX, manager context, and error handling.

## Critical Auth Issue

The sales-coach uses `adminClient.auth.getUser(token)` to identify the caller. The service role key is not a user JWT — `getUser()` will return null, so `userId` stays null and `viewAsUserId` is never applied (it requires `is_super_admin`). This means a naive proxy call with the service role key would result in the sales-coach operating with no user identity.

**Fix**: Add a small internal-call detection block to `sales-coach/index.ts`. If auth yields no user BUT the request includes `viewAsUserId` AND the auth token matches the service role key, trust the provided IDs directly. This is safe because only server-side code has the service role key.

## Changes

### 1. Database Migration

- Add `telegram_update_id` (bigint, nullable) column to `telegram_conversations`
- Add index on `telegram_update_id` for duplicate detection
- Add index on `(user_id, created_at DESC)` for fast conversation history loading

### 2. Sales Coach Auth Bypass for Internal Calls

**File: `supabase/functions/sales-coach/index.ts`** (lines 86-110)

Add a fallback after the existing auth block: if `userId` is still null and `viewAsUserId` is provided, check if the Bearer token equals the service role key. If so, treat `viewAsUserId` and `viewAsCompanyId` as trusted:

```typescript
// After existing auth block (line ~110):
// Internal service call detection (e.g., from telegram-webhook)
if (!userId && viewAsUserId) {
  const token = authHeader?.replace("Bearer ", "");
  if (token === supabaseServiceKey) {
    userId = viewAsUserId;
    const { data: imp } = await adminClient
      .from("profiles").select("company_id").eq("id", viewAsUserId).single();
    companyId = viewAsCompanyId || imp?.company_id || null;
    console.log(`[SalesCoach] Internal call for user ${userId}, company ${companyId}`);
  }
}
```

This is a minimal, safe change — only 8 lines inserted after the existing auth block. No other sales-coach code is modified.

### 3. AI Router Update

**File: `supabase/functions/_shared/ai-router.ts`**

- Add `'telegram-chat'` to the `TaskType` union
- Add routing entry: `'telegram-chat': 'gemini-pro'` (strong reasoning at moderate cost; only used for growth/capability/training queries — sales queries go through sales-coach which uses Opus)

### 4. Telegram Webhook Rewrite

**File: `supabase/functions/telegram-webhook/index.ts`**

Major rewrite of the response generation section. The linking flow, rate limiting, and intent classification stay largely the same. Key changes:

#### New Helper Functions

1. **`sendTelegramMessageWithId()`** — Returns the Telegram `message_id` so we can edit it later
2. **`editTelegramMessage()`** — Uses `editMessageText` API to replace "thinking..." with the real answer; falls back to `sendMessage` if edit fails
3. **`formatForTelegram()`** — Strips unsupported markdown (headers to bold, removes tables), appends action confirmations (deals created, research completed), truncates at 4,000 chars with "...continued in app" suffix
4. **`loadManagerContext()`** — Queries `user_roles` for manager status, loads `manager_assignments` with profiles and growth plan status, returns formatted team context string
5. **`callSalesCoach()`** — Internal `fetch()` to the sales-coach edge function with 45-second AbortController timeout, using the service role key as Bearer token and passing `viewAsUserId`/`viewAsCompanyId` in the body

#### Revised Message Flow

```text
1. Parse update, extract chatId, text, update_id
2. Duplicate check: query telegram_conversations for this update_id → return 200 if exists
3. Linking flow (unchanged)
4. Rate limit check (unchanged)
5. Send "thinking..." via sendTelegramMessageWithId → save message_id
6. Load in parallel:
   - Conversation history (last 10 messages, 24hr window, by user_id)
   - Jericho context (profile, capabilities, goals, targets)
   - Manager context (if applicable)
7. Classify intent (regex first, AI fallback — unchanged logic)
8. Route:
   a. Sales/general/unclear/product_question/pipeline_update/pre_call_prep
      → callSalesCoach() with userId, companyId, message, formatted conversation history
      → Parse JSON: extract .message, .actions, .dealCreated, etc.
      → formatForTelegram()
   b. Growth/capabilities/training/sprint_check
      → callAI() with task type 'telegram-chat' (Gemini Pro)
      → Enhanced system prompt with growth data + manager team data + conversation history
   c. Kudos
      → Direct DB insert into recognitions table (find recipient by name match)
      → Confirmation message
9. Edit "thinking..." message with real response via editTelegramMessage
10. Log to telegram_conversations with update_id and classified message_type
11. Return 200 (always, even on errors)
```

#### Error Handling

- 45-second AbortController timeout on sales-coach internal calls
- On timeout: edit "thinking..." to a friendly "still working on it, check the app" message
- On any error: edit "thinking..." to a graceful fallback with suggestions
- Error logging to `telegram_conversations` with `message_type = 'error'`
- All code paths return HTTP 200 to prevent Telegram retry storms

#### Conversation History Format

Load last 10 messages within 24 hours by `user_id` (not `telegram_chat_id` — ensures continuity if user changes devices). Format as alternating user/assistant text and pass as the `conversationHistory` string parameter to the sales-coach.

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/sales-coach/index.ts` | 8-line auth bypass for internal service calls (lines ~110) |
| `supabase/functions/telegram-webhook/index.ts` | Full rewrite of response generation, new helpers, sales-coach proxy, edit-message UX, duplicate prevention, manager context, error handling |
| `supabase/functions/_shared/ai-router.ts` | Add `'telegram-chat'` task type routed to `'gemini-pro'` |
| Database migration | Add `telegram_update_id` column + 2 indexes |

## Files NOT Modified

- `supabase/functions/sales-coach/analytics.ts` — Untouched
- `supabase/functions/sales-coach/actions.ts` — Untouched
- `supabase/functions/sales-coach/memory.ts` — Untouched

