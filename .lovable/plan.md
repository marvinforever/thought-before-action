

# Fix: Telegram Webhook Secret Mismatch

## Problem
Every incoming Telegram message is rejected with **"Invalid secret token"**. The edge function compares the `X-Telegram-Bot-Api-Secret-Token` header (sent by Telegram using the value from your `setWebhook` call) against the `TELEGRAM_WEBHOOK_SECRET` environment secret. These don't match.

## Root Cause
When you registered the webhook, you used:
```
secret_token=jericho-webhook-2026-FREEDOM-galatians51
```
But the `TELEGRAM_WEBHOOK_SECRET` stored in the backend was likely set to a different value during the earlier setup step.

## Fix
Update the `TELEGRAM_WEBHOOK_SECRET` to exactly: `jericho-webhook-2026-FREEDOM-galatians51`

This is a single secret update — no code changes needed. Once updated, the next message you send to the bot on Telegram should go through successfully.

