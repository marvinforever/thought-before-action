

# Telegram Bot Integration — Updated Plan

Incorporating all feedback: deep linking, conversation memory, dashboard CTA, intent classifier fallback, and kudos confirmation flow.

---

## Architecture

```text
Telegram User
     │
     ▼
Telegram Bot API (webhook POST)
     │
     ▼
┌─────────────────────────────────────────┐
│  telegram-webhook (Edge Function)       │
│                                         │
│  1. Validate secret header              │
│  2. Rate limit check (30/hr)            │
│  3. Lookup telegram_links               │
│     ├─ Unlinked? Check for /start CODE  │
│     │  or raw 6-digit code → link       │
│     └─ Linked? Continue                 │
│  4. Send "thinking..." message          │
│  5. Load last 10 messages from          │
│     telegram_conversations (memory)     │
│  6. Classify intent (flash-lite → AI    │
│     fallback if low confidence)         │
│  7. Load full Jericho context           │
│  8. Route to handler                    │
│  9. Reply via sendMessage               │
│ 10. Log to telegram_conversations      │
└─────────────────────────────────────────┘
```

---

## Phase 1: Database Migration (4 tables)

**`telegram_links`**
- `id` uuid PK, `user_id` uuid references auth.users, `telegram_chat_id` bigint UNIQUE, `telegram_username` text nullable, `linked_at` timestamptz default now(), `is_active` boolean default true
- RLS: Users read/update own row. Service role for inserts.

**`telegram_link_codes`**
- `id` uuid PK, `user_id` uuid references auth.users, `code` text NOT NULL, `expires_at` timestamptz NOT NULL, `used_at` timestamptz nullable, `created_at` timestamptz default now()
- RLS: Users read own codes.
- Index on `code` WHERE `used_at IS NULL`

**`telegram_conversations`**
- `id` uuid PK, `user_id` uuid, `telegram_chat_id` bigint, `message_text` text, `response_text` text, `message_type` text default 'general', `created_at` timestamptz default now()
- RLS: Users read own. Managers read reports via company_id join.

**`telegram_scheduled_messages`** (scaffold only)
- `id` uuid PK, `user_id` uuid, `telegram_chat_id` bigint, `message_text` text, `trigger_type` text, `scheduled_for` timestamptz, `sent_at` timestamptz nullable, `status` text default 'pending', `created_at` timestamptz default now()
- Index on `(status, scheduled_for)` for future cron queries.

---

## Phase 2: Secrets

Two new secrets required before building the edge function:
- **`TELEGRAM_BOT_TOKEN`** — from BotFather
- **`TELEGRAM_WEBHOOK_SECRET`** — generated string for webhook verification

These do not exist yet. Will prompt for them before proceeding with edge function code.

---

## Phase 3: Edge Function — `telegram-webhook/index.ts`

Single file. `verify_jwt = false` in config.toml (Telegram sends unauthenticated POSTs; security via `X-Telegram-Bot-Api-Secret-Token` header).

**Key behaviors:**

1. **Deep link support (`/start CODE`)**: When a user opens `t.me/BotName?start=ABC123`, Telegram sends `/start ABC123`. The webhook extracts the code, validates against `telegram_link_codes`, links the account, and confirms.

2. **Conversation memory**: Before calling the AI, loads the last 10 messages from `telegram_conversations` for that user, ordered by `created_at`, and passes them as conversation history context. This ensures follow-up questions like "what about their purchase history?" work naturally without cold starts.

3. **Intent classification with fallback**: First attempts regex-based classification for obvious patterns (e.g., "kudos to", "log a call", "my 90-day targets"). If no regex matches, calls `gemini-flash-lite` with a classification prompt. If the model returns confidence < 0.6, defaults to the full AI router (`gemini-flash` or the sales-coach pipeline) rather than dumping into "general."

4. **Routing**:
   - Sales queries → reuses `sales-coach` logic (analytics handlers, actions, memory)
   - Growth/performance/capabilities/training → loads context like `chat-with-jericho` does, calls AI via `ai-router`
   - Kudos → inserts into `recognitions` table, confirms back with details: "Kudos sent to Sarah for 'crushing her prospecting goal.' Want to add a personal message?"
   - Pipeline updates → reuses `sales-coach/actions.ts`

5. **"Thinking..." message**: Sends an immediate response via Telegram `sendMessage`, then follows up with the full AI response. Prevents user confusion during processing.

6. **Rate limiting**: Counts messages in `telegram_conversations` for the chat_id in the last hour. If >= 30, responds with a friendly limit message.

7. **Error handling**: If any handler fails, responds with "Something went wrong on my end. Try again in a moment, or hop into the web app for now." Never leaves the user hanging.

---

## Phase 4: Edge Function — `telegram-send-scheduled/index.ts` (Scaffold)

Lightweight function that queries pending scheduled messages and sends via Telegram API. No cron wired yet — just the function ready to invoke.

---

## Phase 5: UI — Settings Page (TelegramLinkCard)

New component `src/components/TelegramLinkCard.tsx` added to `Settings.tsx`:

- If linked: shows "Connected as @username" with Disconnect button
- If not linked:
  1. "Connect Telegram" button generates a 6-digit code in `telegram_link_codes` (15-min expiry)
  2. Displays a **QR code** and a **clickable deep link** (`t.me/BotName?start=CODE`) — one tap to connect, zero typing
  3. Countdown timer showing code expiry
  4. Polls `telegram_links` every 5 seconds for auto-detection of successful linking

---

## Phase 6: UI — Dashboard CTA

**Not buried in Settings.** Add a prominent "Connect on Telegram" card to:

1. **Sales page (`src/pages/Sales.tsx`)** — since this is the landing page (`/`), users see it immediately. A dismissible banner or card: "Get Jericho in your pocket. Connect Telegram in 30 seconds." with the deep link/QR.

2. **Onboarding flow** — add as an optional step in `OnboardingWizard.tsx`: "Want Jericho in your pocket? Connect Telegram." Shows the QR/deep link. Skip button available.

3. **My Growth Plan page** — a small card if not yet connected, hidden once linked.

All CTAs check `telegram_links` for the current user and hide themselves once connected.

---

## Phase 7: UI — Manager Dashboard Widget

New `TelegramEngagementWidget.tsx` added to the Manager Dashboard:
- Total linked users on the team
- Messages per day (last 7 days)
- Breakdown by `message_type` (bar chart)
- Most active users

Queries `telegram_conversations` joined with team membership via existing `manager_assignments` pattern.

---

## Phase 8: Admin Page — `/super-admin/telegram-setup`

New route under SuperAdmin layout:
- BotFather setup instructions
- Webhook URL display (auto-generated from project URL)
- "Register Webhook" button (calls Telegram `setWebhook` API)
- "Test Connection" button
- Status: last message timestamp, total linked users

---

## Phase 9: Manager-Triggered Bulk Invites

Add a "Send Telegram Invite" button to the Manager Dashboard's team view. Sends a personalized deep link (`t.me/BotName?start=CODE`) to each team member via their existing email or SMS channel. Each invite generates a unique code tied to that employee's `user_id`.

---

## Files to Create
1. `supabase/functions/telegram-webhook/index.ts`
2. `supabase/functions/telegram-send-scheduled/index.ts`
3. `src/components/TelegramLinkCard.tsx`
4. `src/components/TelegramEngagementWidget.tsx`
5. `src/components/TelegramConnectCTA.tsx` (reusable CTA for dashboard/onboarding)
6. `src/pages/TelegramSetup.tsx`

## Files to Modify
1. `src/pages/Settings.tsx` — add TelegramLinkCard
2. `src/pages/Sales.tsx` — add TelegramConnectCTA banner
3. `src/components/OnboardingWizard.tsx` — add optional Telegram step
4. `src/pages/MyGrowthPlan.tsx` — add small connect card
5. `src/App.tsx` — add telegram-setup route under super-admin
6. `src/pages/ManagerDashboard.tsx` — add TelegramEngagementWidget

## Implementation Order
1. Database migration (all 4 tables + indexes + RLS)
2. Prompt for `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` secrets
3. `telegram-webhook` edge function with deep linking, memory, intent classification
4. `telegram-send-scheduled` scaffold
5. `TelegramLinkCard` + `TelegramConnectCTA` components
6. Settings page integration
7. Dashboard/onboarding CTAs
8. Admin setup page
9. Manager engagement widget
10. Manager bulk invite feature

