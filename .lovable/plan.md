# Forward-to-Jericho: One Address, Smart Intent

## What changes for the user

Nothing new to remember. Same Jericho email address you already reply to. Just start using it for more:

- **Forward** a customer email thread → Jericho files it under your pipeline
- **Reply** with a question ("what's Prairie Vista at?") → he answers from your data
- **Reply** with a thought ("great call with Henderson today, talked seed for 2027") → he logs it as activity
- **Reply** to a Daily Brief like today → still works exactly the same

One inbox. He figures out what you meant.

## How he tells the difference

The existing `process-email-reply` function gets a new first step: an intent classifier (Claude, fast pass).

```text
inbound email
   ↓
[ verify sender = registered profile.email ]   ← isolation gate
   ↓
[ intent classifier ]
   ├── forward    → has "Forwarded message" / "Begin forwarded message:" / quoted From: headers
   ├── query      → asks about pipeline/customers/deals ("what's…", "show me…", "status on…")
   ├── note       → narrative about an interaction ("had a call with…", "met with…")
   └── reflect    → reply to a Daily Brief / coaching reply  (existing behavior, unchanged)
   ↓
[ route to handler ]
```

## Per-intent behavior

**Forward** — extract grower, contact, deal signals from the quoted thread; reuse existing `createCompany` / `createContact` / `createDeal` / `logActivity` from `sales-coach/actions.ts` (fuzzy-matches existing records, no duplicates); save the raw email body as a note attached to the deal/contact; reply with a confirmation showing what was filed/matched + an undo link.

**Query** — scope to sender's `profile_id` only, run the same Pipeline-First logic as the chat agent, reply with a branded HTML answer (deep navy + gold, table format).

**Note** — log as a `sales_activity` against the closest matched grower/contact; if ambiguous, reply asking which grower (one short question, no menu).

**Reflect** — unchanged; today's Daily Brief reply flow.

## Guardrails (the "sacred" part)

- **Sender identity = data ownership.** `From:` must match a row in `profiles.email`. Unknown sender → polite rejection, logged for super-admin review. No exceptions.
- **Strict tenant isolation.** Every read and write filtered by the sender's `profile_id`. Same RLS that already protects the rest of the Sales Agent.
- **No fabrication.** Extraction follows existing product-recommendation safety rules — never invents product codes, prices, or hybrid numbers.
- **Confirmation before destructive moves.** Stage changes, deletes, or contact merges → "Reply YES to confirm" (matches existing communication safety guardrails).
- **Full audit trail.** Every inbound logged to `email_reply_logs` (already exists) + new `sales_email_forwards` table for sales-specific provenance (raw body, classified intent, extracted entities, action log IDs).

## What I'll build

1. **DB migration** — `sales_email_forwards` table for audit/debug.
2. **Intent classifier** — small Claude Haiku call inside `process-email-reply` that returns `{intent, confidence}`. Fast and cheap.
3. **Forward handler** — Opus extraction → existing `actions.ts` functions → confirmation email via `send-email-reply`.
4. **Query handler** — reuse the sales-coach Q&A path, scoped to sender, formatted as branded HTML email.
5. **Note handler** — light extraction → `logActivity` against matched grower/contact.
6. **Reply formatters** — match the existing email style (table-based HTML, deep navy + gold, sharp-friend tone).
7. **Super-admin test page** — "Simulate Inbound" alongside the Daily Brief preview we just shipped: paste an email, see classified intent + extracted entities + what would be filed + the reply that would go back. No actual writes in test mode.

## Open question

When intent confidence is low (e.g. ambiguous email), should Jericho:
- **A)** Make his best guess and act, with an undo link in the reply (faster, more agentic)
- **B)** Reply asking "want me to file this under Prairie Vista or just log it as a note?" (safer, one extra round-trip)

I'd default to **A** for forwards/notes (low risk — undo is one click) and **B** for destructive moves like stage changes or deletes. Sound right?
