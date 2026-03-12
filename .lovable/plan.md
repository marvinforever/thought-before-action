

# Fix: Parse Resend `email.received` webhook payload correctly

## Problem
Resend's inbound `email.received` webhook nests the email content under `data.payload`, not directly under `data`. The current code reads `rawPayload.data.text` / `rawPayload.data.html`, but the actual structure is:

```json
{
  "type": "email.received",
  "data": {
    "email_id": "...",
    "from": "...",
    "to": "...",
    "subject": "...",
    "payload": {
      "text": "the plain text body",
      "html": "<p>the html body</p>"
    }
  }
}
```

## Fix (single file: `receive-email-reply/index.ts`)

Around lines 46-57, update the field extraction to also check `emailData.payload`:

```typescript
const emailData = rawPayload.data || rawPayload;
const payload = emailData.payload || {};

const from = emailData.from || rawPayload.from;
const to = Array.isArray(emailData.to) ? emailData.to[0] : (emailData.to || rawPayload.to);
const subject = emailData.subject || rawPayload.subject;
const emailId = emailData.email_id || emailData.id || rawPayload.email_id;

// Resend nests body under data.payload.text / data.payload.html
let text = payload.text || emailData.text || emailData.body || rawPayload.text || rawPayload.body || "";
let html = payload.html || emailData.html || rawPayload.html || "";
```

This prioritizes `payload.text` and `payload.html` (the correct Resend fields) while keeping the existing fallbacks for safety. No other changes needed.

